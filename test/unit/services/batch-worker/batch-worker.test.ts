import {describe, it, expect, beforeEach, vi, afterEach} from 'vitest';
import {Message} from '@google-cloud/pubsub';
import BatchWorker from '../../../../src/services/batch-worker/BatchWorker';
import {EventSubscriber} from '../../../../src/services/events/subscriber';
import {TinybirdClient} from '../../../../src/services/tinybird/client';
import logger from '../../../../src/utils/logger';

// Mock EventSubscriber
vi.mock('../../../../src/services/events/subscriber', () => ({
    EventSubscriber: vi.fn().mockImplementation(() => ({
        subscribe: vi.fn(),
        close: vi.fn()
    }))
}));

// Mock TinybirdClient
vi.mock('../../../../src/services/tinybird/client', () => ({
    TinybirdClient: vi.fn().mockImplementation(() => ({
        postEvent: vi.fn().mockResolvedValue(undefined),
        postEventBatch: vi.fn().mockResolvedValue(undefined)
    }))
}));

const createMockMessage = (data: string) => {
    return {
        data: Buffer.from(data),
        ack: vi.fn(),
        nack: vi.fn()
    } as unknown as Message;
};

describe('BatchWorker', () => {
    let batchWorker: BatchWorker;
    let mockSubscriber: EventSubscriber;
    let mockTinybirdClient: TinybirdClient;
    const testTopic = 'test-topic';
    
    const sleep = (ms: number) => new Promise<void>((resolve) => {
        setTimeout(() => resolve(), ms);
    });

    beforeEach(() => {
        vi.clearAllMocks();
        // Mock logger methods to avoid noise in tests
        vi.spyOn(logger, 'info').mockImplementation(() => {});
        vi.spyOn(logger, 'debug').mockImplementation(() => {});
        vi.spyOn(logger, 'error').mockImplementation(() => {});

        mockTinybirdClient = new TinybirdClient({
            apiUrl: 'https://api.tinybird.co',
            apiToken: 'test-token',
            datasource: 'test-datasource'
        });

        batchWorker = new BatchWorker(testTopic, mockTinybirdClient, {
            batchSize: 2,
            flushInterval: 100
        });
        mockSubscriber = (batchWorker as any).subscriber;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create an instance with the provided topic', () => {
            expect(batchWorker).toBeInstanceOf(BatchWorker);
            expect(EventSubscriber).toHaveBeenCalledWith(testTopic);
            expect(logger.info).toHaveBeenCalledWith('Creating batch worker for topic: %s', testTopic);
        });
    });

    describe('start', () => {
        it('should start the subscriber with handleMessage callback', async () => {
            await batchWorker.start();

            expect(logger.info).toHaveBeenCalledWith('Starting batch worker for topic: %s', testTopic);
            expect(mockSubscriber.subscribe).toHaveBeenCalledWith(expect.any(Function));
        });
    });

    describe('stop', () => {
        it('should stop the subscriber', async () => {
            await batchWorker.stop();

            expect(logger.info).toHaveBeenCalledWith('Stopping batch worker for topic: %s', testTopic);
            expect(mockSubscriber.close).toHaveBeenCalled();
        });
    });

    describe('handleMessage', () => {
        const validPageHitRawData = {
            timestamp: '2024-01-01T12:00:00.000Z',
            action: 'page_hit',
            version: '1',
            site_uuid: '550e8400-e29b-41d4-a716-446655440000',
            payload: {
                member_uuid: 'undefined',
                member_status: 'undefined',
                post_uuid: 'undefined',
                post_type: 'null',
                locale: 'en-US',
                location: 'New York',
                referrer: 'https://example.com',
                pathname: '/blog/post',
                href: 'https://mysite.com/blog/post'
            },
            meta: {
                ip: '192.168.1.1',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
            }
        };
        const expectMessageNacked = (message: Message) => {
            expect(message.nack).toHaveBeenCalled();
            expect(message.ack).not.toHaveBeenCalled();
        };

        it('should process valid message and add to batch without immediate ack', async () => {
            const mockMessage = createMockMessage(JSON.stringify(validPageHitRawData));

            await (batchWorker as any).handleMessage(mockMessage);

            // Message should not be acked yet since it's in batch
            expect(mockMessage.ack).not.toHaveBeenCalled();
            expect(mockMessage.nack).not.toHaveBeenCalled();
        });

        it('should transform pageHitRaw to pageHitProcessed and add to batch', async () => {
            const mockMessage = createMockMessage(JSON.stringify(validPageHitRawData));

            await (batchWorker as any).handleMessage(mockMessage);

            // Should log debug message for adding to batch
            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    pageHitProcessed: expect.objectContaining({
                        timestamp: validPageHitRawData.timestamp,
                        action: validPageHitRawData.action,
                        version: validPageHitRawData.version,
                        site_uuid: validPageHitRawData.site_uuid,
                        session_id: expect.any(String),
                        payload: expect.objectContaining({
                            // Original payload fields
                            member_uuid: validPageHitRawData.payload.member_uuid,
                            member_status: validPageHitRawData.payload.member_status,
                            post_uuid: validPageHitRawData.payload.post_uuid,
                            post_type: validPageHitRawData.payload.post_type,
                            locale: validPageHitRawData.payload.locale,
                            location: validPageHitRawData.payload.location,
                            referrer: validPageHitRawData.payload.referrer,
                            pathname: validPageHitRawData.payload.pathname,
                            href: validPageHitRawData.payload.href,
                            // Processed fields
                            os: expect.any(String),
                            browser: expect.any(String),
                            device: expect.any(String)
                        })
                    })
                }),
                'Worker processed message and added to batch'
            );
            
            // Message should not be acked yet
            expect(mockMessage.ack).not.toHaveBeenCalled();
            expect(mockMessage.nack).not.toHaveBeenCalled();
        });

        it('should not immediately call TinybirdClient when single message processed', async () => {
            const mockMessage = createMockMessage(JSON.stringify(validPageHitRawData));

            await (batchWorker as any).handleMessage(mockMessage);

            // Should not post individual events anymore - only batch posts
            expect(mockTinybirdClient.postEvent).not.toHaveBeenCalled();
            expect(mockTinybirdClient.postEventBatch).not.toHaveBeenCalled();

            // Message should not be acked or nacked yet
            expect(mockMessage.ack).not.toHaveBeenCalled();
            expect(mockMessage.nack).not.toHaveBeenCalled();
        });

        // This test is now covered by the batch processing tests
        // since individual message processing doesn't immediately post to Tinybird

        it('should handle invalid JSON and nack message', async () => {
            const invalidJson = 'invalid json';
            const mockMessage = createMockMessage(invalidJson);

            await (batchWorker as any).handleMessage(mockMessage);

            expectMessageNacked(mockMessage);
        });

        it('should handle invalid schema and nack message', async () => {
            const invalidData = {
                timestamp: 'invalid-timestamp',
                action: 'invalid-action',
                version: '2'
            };
            const mockMessage = createMockMessage(JSON.stringify(invalidData));

            await (batchWorker as any).handleMessage(mockMessage);

            expectMessageNacked(mockMessage);
        });

        it('should handle missing required fields and nack message', async () => {
            const incompleteData = {
                timestamp: '2024-01-01T12:00:00.000Z',
                action: 'page_hit'
                // Missing required fields
            };
            const mockMessage = createMockMessage(JSON.stringify(incompleteData));

            await (batchWorker as any).handleMessage(mockMessage);

            expectMessageNacked(mockMessage);
        });

        it('should handle empty message data', async () => {
            const mockMessage = createMockMessage('');

            await (batchWorker as any).handleMessage(mockMessage);

            expectMessageNacked(mockMessage);
        });

        it('should handle valid message with null values in payload', async () => {
            const dataWithNulls = {
                ...validPageHitRawData,
                payload: {
                    ...validPageHitRawData.payload,
                    location: null,
                    referrer: null
                }
            };
            const mockMessage = createMockMessage(JSON.stringify(dataWithNulls));

            await (batchWorker as any).handleMessage(mockMessage);

            // Message should be added to batch without immediate ack
            expect(mockMessage.ack).not.toHaveBeenCalled();
            expect(mockMessage.nack).not.toHaveBeenCalled();
        });

        it('should handle valid message with different post types', async () => {
            const testCases = ['null', 'post', 'page'];
            const messages = [];
            
            for (const postType of testCases) {
                const dataWithPostType = {
                    ...validPageHitRawData,
                    payload: {
                        ...validPageHitRawData.payload,
                        post_type: postType
                    }
                };
                const mockMessage = createMockMessage(JSON.stringify(dataWithPostType));
                messages.push(mockMessage);

                await (batchWorker as any).handleMessage(mockMessage);
            }

            // First two messages should be acked (batch size is 2) but the third should still be pending
            expect(messages[0].ack).toHaveBeenCalled();
            expect(messages[1].ack).toHaveBeenCalled();
            expect(messages[2].ack).not.toHaveBeenCalled();
            expect(messages[2].nack).not.toHaveBeenCalled();
        });

        it('should handle invalid UUID formats', async () => {
            const invalidUuidData = {
                ...validPageHitRawData,
                site_uuid: 'invalid-uuid'
            };
            const mockMessage = createMockMessage(JSON.stringify(invalidUuidData));

            await (batchWorker as any).handleMessage(mockMessage);

            expectMessageNacked(mockMessage);
        });

        it('should handle invalid URL format in href', async () => {
            const invalidUrlData = {
                ...validPageHitRawData,
                payload: {
                    ...validPageHitRawData.payload,
                    href: 'not-a-url'
                }
            };
            const mockMessage = createMockMessage(JSON.stringify(invalidUrlData));

            await (batchWorker as any).handleMessage(mockMessage);

            expectMessageNacked(mockMessage);
        });
    });

    describe('batch processing', () => {
        const validPageHitRawData = {
            timestamp: '2024-01-01T12:00:00.000Z',
            action: 'page_hit',
            version: '1',
            site_uuid: '550e8400-e29b-41d4-a716-446655440000',
            payload: {
                member_uuid: 'undefined',
                member_status: 'undefined',
                post_uuid: 'undefined',
                post_type: 'null',
                locale: 'en-US',
                location: 'New York',
                referrer: 'https://example.com',
                pathname: '/blog/post',
                href: 'https://mysite.com/blog/post'
            },
            meta: {
                ip: '192.168.1.1',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
            }
        };

        it('should accumulate messages in batch without immediately posting', async () => {
            const mockMessage = createMockMessage(JSON.stringify(validPageHitRawData));

            await (batchWorker as any).handleMessage(mockMessage);

            // Should not have called postEventBatch yet (batch size is 2)
            expect(mockTinybirdClient.postEventBatch).not.toHaveBeenCalled();
            expect(mockMessage.ack).not.toHaveBeenCalled();
            expect(mockMessage.nack).not.toHaveBeenCalled();
        });

        it('should flush batch when batch size is reached', async () => {
            const mockMessage1 = createMockMessage(JSON.stringify(validPageHitRawData));
            const mockMessage2 = createMockMessage(JSON.stringify(validPageHitRawData));

            await (batchWorker as any).handleMessage(mockMessage1);
            await (batchWorker as any).handleMessage(mockMessage2);

            // Should have flushed the batch
            expect(mockTinybirdClient.postEventBatch).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        timestamp: validPageHitRawData.timestamp,
                        action: validPageHitRawData.action
                    }),
                    expect.objectContaining({
                        timestamp: validPageHitRawData.timestamp,
                        action: validPageHitRawData.action
                    })
                ])
            );
            expect(mockMessage1.ack).toHaveBeenCalled();
            expect(mockMessage2.ack).toHaveBeenCalled();
        });

        it('should flush batch on timer expiry', async () => {
            const mockMessage = createMockMessage(JSON.stringify(validPageHitRawData));

            // Start the worker to initialize the timer
            await batchWorker.start();
            
            await (batchWorker as any).handleMessage(mockMessage);
            
            // Wait for timer to expire
            await sleep(150);

            expect(mockTinybirdClient.postEventBatch).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        timestamp: validPageHitRawData.timestamp,
                        action: validPageHitRawData.action
                    })
                ])
            );
            expect(mockMessage.ack).toHaveBeenCalled();
            
            await batchWorker.stop();
        });

        it('should flush all pending batches on stop', async () => {
            const mockMessage = createMockMessage(JSON.stringify(validPageHitRawData));

            await (batchWorker as any).handleMessage(mockMessage);
            await batchWorker.stop();

            expect(mockTinybirdClient.postEventBatch).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        timestamp: validPageHitRawData.timestamp,
                        action: validPageHitRawData.action
                    })
                ])
            );
            expect(mockMessage.ack).toHaveBeenCalled();
        });

        it('should nack all messages in batch if Tinybird posting fails', async () => {
            const mockMessage1 = createMockMessage(JSON.stringify(validPageHitRawData));
            const mockMessage2 = createMockMessage(JSON.stringify(validPageHitRawData));
            const tinybirdError = new Error('Tinybird batch API error');
            
            (mockTinybirdClient.postEventBatch as any).mockRejectedValueOnce(tinybirdError);

            await (batchWorker as any).handleMessage(mockMessage1);
            
            await (batchWorker as any).handleMessage(mockMessage2);

            expect(mockMessage1.nack).toHaveBeenCalled();
            expect(mockMessage2.nack).toHaveBeenCalled();
            expect(mockMessage1.ack).not.toHaveBeenCalled();
            expect(mockMessage2.ack).not.toHaveBeenCalled();
        });

        it('should handle empty batch gracefully', async () => {
            await (batchWorker as any).flushBatch();
            expect(mockTinybirdClient.postEventBatch).not.toHaveBeenCalled();
        });

        it('should use configuration defaults from environment variables', () => {
            const defaultBatchWorker = new BatchWorker(testTopic, mockTinybirdClient);
            expect(defaultBatchWorker).toBeInstanceOf(BatchWorker);
        });

        it('should use custom configuration over defaults', () => {
            const customBatchWorker = new BatchWorker(testTopic, mockTinybirdClient, {
                batchSize: 100,
                flushInterval: 1000
            });
            expect(customBatchWorker).toBeInstanceOf(BatchWorker);
        });
    });
});