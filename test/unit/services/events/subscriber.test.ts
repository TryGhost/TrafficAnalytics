import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {EventSubscriber} from '../../../../src/services/events/subscriber.js';
import type {FastifyBaseLogger} from 'fastify';
import {PubSub} from '@google-cloud/pubsub';

// Mock @google-cloud/pubsub
vi.mock('@google-cloud/pubsub', () => {
    const MockMessage = vi.fn();
    const MockSubscription = vi.fn();
    const MockPubSub = vi.fn();
    
    return {
        PubSub: MockPubSub,
        Subscription: MockSubscription,
        Message: MockMessage
    };
});

describe('EventSubscriber', () => {
    let subscriber: EventSubscriber;
    let mockLogger: FastifyBaseLogger;
    let mockPubSub: any;
    let mockSubscription: any;
    let mockMessage: any;
    
    const testOptions = {
        projectId: 'test-project',
        subscriptionName: 'test-subscription',
        topicName: 'test-topic',
        logger: {} as FastifyBaseLogger
    };

    beforeEach(() => {
        // Reset all mocks
        vi.resetAllMocks();
        
        // Create mock logger
        mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
            trace: vi.fn(),
            fatal: vi.fn(),
            level: 'info',
            silent: false,
            child: () => mockLogger
        } as unknown as FastifyBaseLogger;
        
        // Create mock subscription
        mockSubscription = {
            on: vi.fn(),
            close: vi.fn().mockResolvedValue(undefined)
        };
        
        // Create mock PubSub
        mockPubSub = {
            subscription: vi.fn().mockReturnValue(mockSubscription)
        };
        
        // Mock PubSub constructor
        (PubSub as any).mockImplementation(() => mockPubSub);
        
        // Create mock message
        mockMessage = {
            id: 'test-message-id',
            data: Buffer.from(JSON.stringify({action: 'page_hit', url: 'https://example.com'})),
            publishTime: new Date('2023-01-01T00:00:00.000Z'),
            ack: vi.fn(),
            nack: vi.fn()
        };
        
        subscriber = new EventSubscriber();
        testOptions.logger = mockLogger;
    });

    afterEach(async () => {
        try {
            await subscriber.stop();
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('start', () => {
        it('should initialize PubSub client with correct project ID', async () => {
            await subscriber.start(testOptions);
            
            expect(PubSub).toHaveBeenCalledWith({projectId: testOptions.projectId});
            expect(mockPubSub.subscription).toHaveBeenCalledWith(testOptions.subscriptionName);
        });

        it('should set up message and error handlers', async () => {
            await subscriber.start(testOptions);
            
            expect(mockSubscription.on).toHaveBeenCalledWith('message', expect.any(Function));
            expect(mockSubscription.on).toHaveBeenCalledWith('error', expect.any(Function));
        });

        it('should log successful subscription start', async () => {
            await subscriber.start(testOptions);
            
            expect(mockLogger.info).toHaveBeenCalledWith({
                projectId: testOptions.projectId,
                subscriptionName: testOptions.subscriptionName,
                topicName: testOptions.topicName
            }, 'Started pull subscription');
        });
    });

    describe('message handling', () => {
        beforeEach(async () => {
            await subscriber.start(testOptions);
        });

        it('should process valid messages and acknowledge them', async () => {
            // Get the message handler from the subscription.on call
            const messageHandler = mockSubscription.on.mock.calls.find(
                (call: any) => call[0] === 'message'
            )[1];
            
            messageHandler(mockMessage);
            
            expect(mockLogger.info).toHaveBeenCalledWith({
                messageId: mockMessage.id,
                publishTime: mockMessage.publishTime.toISOString(),
                eventData: {action: 'page_hit', url: 'https://example.com'},
                payloadSize: mockMessage.data.length
            }, 'Received page-hits-raw event');
            
            expect(mockMessage.ack).toHaveBeenCalled();
            expect(mockMessage.nack).not.toHaveBeenCalled();
        });

        it('should handle messages with no publish time', async () => {
            const messageWithoutTime = {
                ...mockMessage,
                publishTime: null
            };
            
            const messageHandler = mockSubscription.on.mock.calls.find(
                (call: any) => call[0] === 'message'
            )[1];
            
            messageHandler(messageWithoutTime);
            
            expect(mockLogger.info).toHaveBeenCalledWith({
                messageId: messageWithoutTime.id,
                publishTime: null,
                eventData: {action: 'page_hit', url: 'https://example.com'},
                payloadSize: messageWithoutTime.data.length
            }, 'Received page-hits-raw event');
            
            expect(messageWithoutTime.ack).toHaveBeenCalled();
        });

        it('should nack messages with invalid JSON', async () => {
            const invalidMessage = {
                ...mockMessage,
                data: Buffer.from('invalid json')
            };
            
            const messageHandler = mockSubscription.on.mock.calls.find(
                (call: any) => call[0] === 'message'
            )[1];
            
            messageHandler(invalidMessage);
            
            expect(mockLogger.error).toHaveBeenCalledWith({
                messageId: invalidMessage.id,
                error: expect.stringContaining('Unexpected token'),
                rawData: 'invalid json'
            }, 'Failed to parse message data');
            
            expect(invalidMessage.nack).toHaveBeenCalled();
            expect(invalidMessage.ack).not.toHaveBeenCalled();
        });

        it('should nack messages during shutdown', async () => {
            await subscriber.stop();
            
            const messageHandler = mockSubscription.on.mock.calls.find(
                (call: any) => call[0] === 'message'
            )[1];
            
            messageHandler(mockMessage);
            
            expect(mockMessage.nack).toHaveBeenCalled();
            expect(mockMessage.ack).not.toHaveBeenCalled();
            expect(mockLogger.info).not.toHaveBeenCalledWith(
                expect.objectContaining({messageId: mockMessage.id}),
                'Received page-hits-raw event'
            );
        });

        it('should handle processing errors and nack messages', async () => {
            // Mock message.ack to throw an error
            mockMessage.ack.mockImplementation(() => {
                throw new Error('Ack failed');
            });
            
            const messageHandler = mockSubscription.on.mock.calls.find(
                (call: any) => call[0] === 'message'
            )[1];
            
            messageHandler(mockMessage);
            
            expect(mockLogger.error).toHaveBeenCalledWith({
                messageId: mockMessage.id,
                error: 'Ack failed'
            }, 'Failed to process message');
            
            expect(mockMessage.nack).toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        beforeEach(async () => {
            await subscriber.start(testOptions);
        });

        it('should log subscription errors', async () => {
            const testError = new Error('Subscription error');
            
            const errorHandler = mockSubscription.on.mock.calls.find(
                (call: any) => call[0] === 'error'
            )[1];
            
            errorHandler(testError);
            
            expect(mockLogger.error).toHaveBeenCalledWith({
                error: testError.message,
                stack: testError.stack
            }, 'Pub/Sub subscription error');
        });
    });

    describe('stop', () => {
        it('should gracefully stop when no subscription exists', async () => {
            await expect(subscriber.stop()).resolves.not.toThrow();
        });

        it('should close subscription and log success', async () => {
            await subscriber.start(testOptions);
            await subscriber.stop();
            
            expect(mockLogger.info).toHaveBeenCalledWith('Stopping Pub/Sub subscription...');
            expect(mockSubscription.close).toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith('Pub/Sub subscription stopped successfully');
        });

        it('should handle and rethrow close errors', async () => {
            const closeError = new Error('Close failed');
            mockSubscription.close.mockRejectedValue(closeError);
            
            await subscriber.start(testOptions);
            
            await expect(subscriber.stop()).rejects.toThrow('Close failed');
            
            expect(mockLogger.error).toHaveBeenCalledWith({
                error: closeError.message
            }, 'Error stopping Pub/Sub subscription');
        });

        it('should set isShuttingDown flag', async () => {
            await subscriber.start(testOptions);
            await subscriber.stop();
            
            // Verify that new messages are nacked after shutdown
            const messageHandler = mockSubscription.on.mock.calls.find(
                (call: any) => call[0] === 'message'
            )[1];
            
            messageHandler(mockMessage);
            expect(mockMessage.nack).toHaveBeenCalled();
        });
    });

    describe('configuration', () => {
        it('should use provided environment variables', async () => {
            const customOptions = {
                projectId: 'custom-project',
                subscriptionName: 'custom-subscription',
                topicName: 'custom-topic',
                logger: mockLogger
            };
            
            await subscriber.start(customOptions);
            
            expect(PubSub).toHaveBeenCalledWith({projectId: 'custom-project'});
            expect(mockPubSub.subscription).toHaveBeenCalledWith('custom-subscription');
        });
    });
});