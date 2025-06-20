import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import request from 'supertest';
import {FastifyInstance} from 'fastify';
import * as subscriberModule from '../../src/services/events/subscriber.js';

// Mock the subscriber module
vi.mock('../../src/services/events/subscriber.js', () => {
    const MockEventSubscriber = vi.fn();
    MockEventSubscriber.prototype.start = vi.fn().mockResolvedValue(undefined);
    MockEventSubscriber.prototype.stop = vi.fn().mockResolvedValue(undefined);
    
    return {
        EventSubscriber: MockEventSubscriber
    };
});

// Mock config for worker mode tests
vi.mock('@tryghost/config', () => ({
    default: {
        get: vi.fn()
    }
}));

describe('Worker Mode Integration Tests', () => {
    let app: FastifyInstance;
    let mockSubscriber: any;
    
    beforeEach(() => {
        // Reset all mocks
        vi.resetAllMocks();
        
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
        // Clean up environment
        delete process.env.WORKER_MODE;
        delete process.env.GOOGLE_CLOUD_PROJECT;
        delete process.env.GCP_PROJECT_ID;
        delete process.env.PUBSUB_SUBSCRIPTION_NAME;
        delete process.env.PUBSUB_TOPIC_NAME;
        vi.resetModules();
    });

    describe('Worker App with Pub/Sub Integration', () => {
        beforeEach(async () => {
            // Set up environment for worker mode
            process.env.WORKER_MODE = 'true';
            process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
            process.env.PUBSUB_SUBSCRIPTION_NAME = 'test-subscription';
            process.env.PUBSUB_TOPIC_NAME = 'test-topic';
            
            // Set up config mock
            const config = await import('@tryghost/config');
            (config.default.get as any).mockImplementation((key: string) => {
                const configs: Record<string, string | boolean> = {
                    WORKER_MODE: 'true',
                    GOOGLE_CLOUD_PROJECT: 'test-project',
                    PUBSUB_SUBSCRIPTION_NAME: 'test-subscription',
                    PUBSUB_TOPIC_NAME: 'test-topic',
                    TRUST_PROXY: true
                };
                return configs[key];
            });
            
            vi.resetModules();
            
            // Import server module which should load worker app
            const serverModule = await import('../../server');
            app = serverModule.default;
            await app.ready();
        });

        it('should start Pub/Sub subscription when app is ready', async () => {
            expect(subscriberModule.EventSubscriber).toHaveBeenCalledTimes(1);
            expect(mockSubscriber.start).toHaveBeenCalledWith({
                projectId: 'test-project',
                subscriptionName: 'test-subscription',
                topicName: 'test-topic',
                logger: app.log
            });
        });

        it('should have worker health endpoints available', async () => {
            const rootResponse = await request(app.server)
                .get('/')
                .expect(200);

            const healthResponse = await request(app.server)
                .get('/health')
                .expect(200);

            expect(rootResponse.body).toEqual({status: 'worker-healthy'});
            expect(healthResponse.body).toEqual({status: 'worker-healthy'});
        });

        it('should not have proxy routes available', async () => {
            const response = await request(app.server)
                .post('/tb/web_analytics?token=test&name=test')
                .send({payload: {site_uuid: 'test'}})
                .set('x-site-uuid', 'test-site');

            expect(response.status).toBe(404);
        });

        it('should stop subscription when app closes', async () => {
            await app.close();
            
            expect(mockSubscriber.stop).toHaveBeenCalledTimes(1);
        });

        it('should have logging capabilities', () => {
            expect(app.log).toBeDefined();
            expect(typeof app.log.info).toBe('function');
            expect(typeof app.log.error).toBe('function');
        });
    });

    describe('Environment Variable Configuration', () => {
        it('should use default subscription and topic names', async () => {
            process.env.WORKER_MODE = 'true';
            process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
            // Don't set PUBSUB_SUBSCRIPTION_NAME and PUBSUB_TOPIC_NAME
            
            const config = await import('@tryghost/config');
            (config.default.get as any).mockImplementation((key: string) => {
                const configs: Record<string, string | undefined> = {
                    WORKER_MODE: 'true',
                    GOOGLE_CLOUD_PROJECT: 'test-project',
                    PUBSUB_SUBSCRIPTION_NAME: undefined,
                    PUBSUB_TOPIC_NAME: undefined,
                    TRUST_PROXY: 'true'
                };
                return configs[key];
            });
            
            vi.resetModules();
            
            const serverModule = await import('../../server');
            app = serverModule.default;
            await app.ready();
            
            expect(mockSubscriber.start).toHaveBeenCalledWith({
                projectId: 'test-project',
                subscriptionName: 'page-hits-raw-subscription',
                topicName: 'page-hits-raw',
                logger: app.log
            });
        });

        it('should use GCP_PROJECT_ID as fallback', async () => {
            process.env.WORKER_MODE = 'true';
            process.env.GCP_PROJECT_ID = 'fallback-project';
            
            const config = await import('@tryghost/config');
            (config.default.get as any).mockImplementation((key: string) => {
                const configs: Record<string, string | undefined> = {
                    WORKER_MODE: 'true',
                    GOOGLE_CLOUD_PROJECT: undefined,
                    GCP_PROJECT_ID: 'fallback-project',
                    PUBSUB_SUBSCRIPTION_NAME: 'test-subscription',
                    PUBSUB_TOPIC_NAME: 'test-topic',
                    TRUST_PROXY: 'true'
                };
                return configs[key];
            });
            
            vi.resetModules();
            
            const serverModule = await import('../../server');
            app = serverModule.default;
            await app.ready();
            
            expect(mockSubscriber.start).toHaveBeenCalledWith({
                projectId: 'fallback-project',
                subscriptionName: 'test-subscription',
                topicName: 'test-topic',
                logger: app.log
            });
        });

        it('should fail when no project ID is configured', async () => {
            process.env.WORKER_MODE = 'true';
            // Don't set GOOGLE_CLOUD_PROJECT or GCP_PROJECT_ID
            
            const config = await import('@tryghost/config');
            (config.default.get as any).mockImplementation((key: string) => {
                const configs: Record<string, string | undefined> = {
                    WORKER_MODE: 'true',
                    GOOGLE_CLOUD_PROJECT: undefined,
                    GCP_PROJECT_ID: undefined,
                    PUBSUB_SUBSCRIPTION_NAME: 'test-subscription',
                    PUBSUB_TOPIC_NAME: 'test-topic',
                    TRUST_PROXY: 'true'
                };
                return configs[key];
            });
            
            vi.resetModules();
            
            const serverModule = await import('../../server');
            app = serverModule.default;
            
            await expect(app.ready()).rejects.toThrow(
                'GOOGLE_CLOUD_PROJECT or GCP_PROJECT_ID environment variable is required for worker mode'
            );
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            process.env.WORKER_MODE = 'true';
            process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
        });

        it('should handle subscription start failures', async () => {
            const startError = new Error('Failed to start subscription');
            mockSubscriber.start.mockRejectedValue(startError);
            
            const config = await import('@tryghost/config');
            (config.default.get as any).mockImplementation((key: string) => {
                const configs: Record<string, string> = {
                    GOOGLE_CLOUD_PROJECT: 'test-project',
                    PUBSUB_SUBSCRIPTION_NAME: 'test-subscription',
                    PUBSUB_TOPIC_NAME: 'test-topic',
                    TRUST_PROXY: 'true'
                };
                return configs[key];
            });
            
            vi.resetModules();
            
            const serverModule = await import('../../server');
            app = serverModule.default;
            
            await expect(app.ready()).rejects.toThrow('Failed to start subscription');
        });

        it('should handle subscription stop failures gracefully', async () => {
            const stopError = new Error('Failed to stop subscription');
            mockSubscriber.stop.mockRejectedValue(stopError);
            
            const config = await import('@tryghost/config');
            (config.default.get as any).mockImplementation((key: string) => {
                const configs: Record<string, string> = {
                    GOOGLE_CLOUD_PROJECT: 'test-project',
                    PUBSUB_SUBSCRIPTION_NAME: 'test-subscription',
                    PUBSUB_TOPIC_NAME: 'test-topic',
                    TRUST_PROXY: 'true'
                };
                return configs[key];
            });
            
            vi.resetModules();
            
            const serverModule = await import('../../server');
            app = serverModule.default;
            await app.ready();
            
            // Should not throw even if stop fails
            await expect(app.close()).resolves.not.toThrow();
            expect(mockSubscriber.stop).toHaveBeenCalledTimes(1);
        });
    });

    describe('Plugin Integration', () => {
        beforeEach(async () => {
            process.env.WORKER_MODE = 'true';
            process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
            
            const config = await import('@tryghost/config');
            (config.default.get as any).mockImplementation((key: string) => {
                const configs: Record<string, string> = {
                    GOOGLE_CLOUD_PROJECT: 'test-project',
                    PUBSUB_SUBSCRIPTION_NAME: 'test-subscription',
                    PUBSUB_TOPIC_NAME: 'test-topic',
                    TRUST_PROXY: 'true'
                };
                return configs[key];
            });
        });

        it('should have both logging and batch worker plugins registered', async () => {
            vi.resetModules();
            
            const serverModule = await import('../../server');
            app = serverModule.default;
            await app.ready();
            
            // Verify subscriber was created and started
            expect(subscriberModule.EventSubscriber).toHaveBeenCalledTimes(1);
            expect(mockSubscriber.start).toHaveBeenCalledTimes(1);
            
            // Verify logging is available
            expect(app.log).toBeDefined();
        });

        it('should maintain heartbeat logging alongside subscription', async () => {
            vi.resetModules();
            
            const serverModule = await import('../../server');
            app = serverModule.default;
            await app.ready();
            
            // Both heartbeat and subscription should be active
            expect(mockSubscriber.start).toHaveBeenCalledTimes(1);
            expect(app.log).toBeDefined();
            
            // Test that we can still log heartbeat messages
            expect(() => app.log.info('Worker heartbeat - processing events...')).not.toThrow();
        });
    });

    describe('Response Headers and Content Types', () => {
        beforeEach(async () => {
            process.env.WORKER_MODE = 'true';
            process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
            
            const config = await import('@tryghost/config');
            (config.default.get as any).mockImplementation(() => {
                return 'test-project';
            });
            
            vi.resetModules();
            
            const serverModule = await import('../../server');
            app = serverModule.default;
            await app.ready();
        });

        it('should return correct content-type for health endpoints', async () => {
            const rootResponse = await request(app.server)
                .get('/')
                .expect(200);

            const healthResponse = await request(app.server)
                .get('/health')
                .expect(200);

            expect(rootResponse.headers['content-type']).toMatch(/application\/json/);
            expect(healthResponse.headers['content-type']).toMatch(/application\/json/);
        });

        it('should handle non-existent routes with 404', async () => {
            await request(app.server)
                .get('/non-existent-route')
                .expect(404);
        });

        it('should handle invalid HTTP methods on health endpoints', async () => {
            await request(app.server)
                .post('/')
                .expect(404);

            await request(app.server)
                .put('/health')
                .expect(404);
        });
    });
});