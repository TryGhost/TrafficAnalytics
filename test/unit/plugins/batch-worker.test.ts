import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {FastifyInstance} from 'fastify';
import fastify from 'fastify';
import batchWorkerPlugin from '../../../src/plugins/batch-worker.js';
import * as subscriberModule from '../../../src/services/events/subscriber.js';

// Mock the entire subscriber module
vi.mock('../../../src/services/events/subscriber.js', () => {
    const MockEventSubscriber = vi.fn();
    MockEventSubscriber.prototype.start = vi.fn().mockResolvedValue(undefined);
    MockEventSubscriber.prototype.stop = vi.fn().mockResolvedValue(undefined);
    
    return {
        EventSubscriber: MockEventSubscriber
    };
});

// Mock config
vi.mock('@tryghost/config', () => ({
    default: {
        get: vi.fn()
    }
}));

describe('Batch Worker Plugin', () => {
    let app: FastifyInstance;
    let mockSubscriber: any;
    
    beforeEach(async () => {
        // Reset all mocks
        vi.resetAllMocks();
        
        // Get mock config
        const config = await import('@tryghost/config');
        
        // Set up default config values
        (config.default.get as any).mockImplementation((key: string) => {
            const configs: Record<string, string> = {
                GOOGLE_CLOUD_PROJECT: 'test-project',
                PUBSUB_SUBSCRIPTION_NAME: 'test-subscription',
                PUBSUB_TOPIC_NAME: 'test-topic'
            };
            return configs[key];
        });
        
        // Create fresh Fastify instance
        app = fastify({
            logger: false // Disable logging for tests
        });
        
        // Create mock subscriber instance
        mockSubscriber = {
            start: vi.fn().mockResolvedValue(undefined),
            stop: vi.fn().mockResolvedValue(undefined)
        };
        
        // Mock EventSubscriber constructor to return our mock
        (subscriberModule.EventSubscriber as any).mockImplementation(() => mockSubscriber);
    });

    afterEach(async () => {
        if (app) {
            await app.close();
        }
    });

    describe('Plugin Registration', () => {
        it('should register plugin without errors', async () => {
            await expect(app.register(batchWorkerPlugin)).resolves.not.toThrow();
        });

        it('should create EventSubscriber instance', async () => {
            await app.register(batchWorkerPlugin);
            
            expect(subscriberModule.EventSubscriber).toHaveBeenCalledTimes(1);
        });
    });

    describe('onReady Hook', () => {
        it('should start subscriber with correct configuration', async () => {
            await app.register(batchWorkerPlugin);
            await app.ready();
            
            expect(mockSubscriber.start).toHaveBeenCalledWith({
                projectId: 'test-project',
                subscriptionName: 'test-subscription',
                topicName: 'test-topic',
                logger: app.log
            });
        });

        it('should use default values when config not set', async () => {
            const config = await import('@tryghost/config');
            
            // Mock config to return undefined for optional values
            (config.default.get as any).mockImplementation((key: string) => {
                const configs: Record<string, string | undefined> = {
                    GOOGLE_CLOUD_PROJECT: 'test-project',
                    PUBSUB_SUBSCRIPTION_NAME: undefined,
                    PUBSUB_TOPIC_NAME: undefined
                };
                return configs[key];
            });
            
            await app.register(batchWorkerPlugin);
            await app.ready();
            
            expect(mockSubscriber.start).toHaveBeenCalledWith({
                projectId: 'test-project',
                subscriptionName: 'page-hits-raw-subscription',
                topicName: 'page-hits-raw',
                logger: app.log
            });
        });

        it('should use GCP_PROJECT_ID as fallback', async () => {
            const config = await import('@tryghost/config');
            
            // Mock config to return undefined for GOOGLE_CLOUD_PROJECT but value for GCP_PROJECT_ID
            (config.default.get as any).mockImplementation((key: string) => {
                const configs: Record<string, string | undefined> = {
                    GOOGLE_CLOUD_PROJECT: undefined,
                    GCP_PROJECT_ID: 'fallback-project',
                    PUBSUB_SUBSCRIPTION_NAME: 'test-subscription',
                    PUBSUB_TOPIC_NAME: 'test-topic'
                };
                return configs[key];
            });
            
            await app.register(batchWorkerPlugin);
            await app.ready();
            
            expect(mockSubscriber.start).toHaveBeenCalledWith({
                projectId: 'fallback-project',
                subscriptionName: 'test-subscription',
                topicName: 'test-topic',
                logger: app.log
            });
        });

        it('should throw error when no project ID is configured', async () => {
            const config = await import('@tryghost/config');
            
            // Mock config to return undefined for both project ID variables
            (config.default.get as any).mockImplementation((key: string) => {
                const configs: Record<string, string | undefined> = {
                    GOOGLE_CLOUD_PROJECT: undefined,
                    GCP_PROJECT_ID: undefined,
                    PUBSUB_SUBSCRIPTION_NAME: 'test-subscription',
                    PUBSUB_TOPIC_NAME: 'test-topic'
                };
                return configs[key];
            });
            
            await app.register(batchWorkerPlugin);
            
            await expect(app.ready()).rejects.toThrow(
                'GOOGLE_CLOUD_PROJECT or GCP_PROJECT_ID environment variable is required for worker mode'
            );
        });

        it('should propagate subscriber start errors', async () => {
            const startError = new Error('Failed to start subscriber');
            mockSubscriber.start.mockRejectedValue(startError);
            
            await app.register(batchWorkerPlugin);
            
            await expect(app.ready()).rejects.toThrow('Failed to start subscriber');
        });
    });

    describe('onClose Hook', () => {
        it('should stop subscriber on app close', async () => {
            await app.register(batchWorkerPlugin);
            await app.ready();
            await app.close();
            
            expect(mockSubscriber.stop).toHaveBeenCalledTimes(1);
        });

        it('should not throw error if subscriber stop fails', async () => {
            const stopError = new Error('Failed to stop subscriber');
            mockSubscriber.stop.mockRejectedValue(stopError);
            
            await app.register(batchWorkerPlugin);
            await app.ready();
            
            // Should not throw even if stop fails
            await expect(app.close()).resolves.not.toThrow();
            expect(mockSubscriber.stop).toHaveBeenCalledTimes(1);
        });

        it('should handle non-Error objects in stop failure', async () => {
            mockSubscriber.stop.mockRejectedValue('string error');
            
            await app.register(batchWorkerPlugin);
            await app.ready();
            
            await expect(app.close()).resolves.not.toThrow();
        });
    });

    describe('Error Handling', () => {
        it('should handle Error objects in start failure', async () => {
            const startError = new Error('Subscription failed');
            mockSubscriber.start.mockRejectedValue(startError);
            
            await app.register(batchWorkerPlugin);
            
            await expect(app.ready()).rejects.toThrow('Subscription failed');
        });

        it('should handle non-Error objects in start failure', async () => {
            mockSubscriber.start.mockRejectedValue('string error');
            
            await app.register(batchWorkerPlugin);
            
            await expect(app.ready()).rejects.toThrow('string error');
        });
    });

    describe('Integration with Fastify Lifecycle', () => {
        it('should work with multiple plugin registrations', async () => {
            // Register a simple test plugin first
            await app.register(async (instance) => {
                instance.get('/test', async () => ({test: true}));
            });
            
            // Register batch worker plugin
            await app.register(batchWorkerPlugin);
            
            await app.ready();
            
            expect(mockSubscriber.start).toHaveBeenCalledTimes(1);
        });

        it('should respect Fastify plugin encapsulation', async () => {
            await app.register(async (instance) => {
                await instance.register(batchWorkerPlugin);
            });
            
            await app.ready();
            
            expect(mockSubscriber.start).toHaveBeenCalledTimes(1);
        });
    });
});