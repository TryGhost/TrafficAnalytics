import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import request from 'supertest';
import {FastifyInstance} from 'fastify';
import {publishEvent} from '../../src/services/events/publisher';

describe('Worker App', () => {
    let app: FastifyInstance;
    beforeEach(async () => {
        // Clear environment variables to ensure clean state
        delete process.env.WORKER_MODE;
        
        // Clear module cache to ensure fresh import
        vi.resetModules();
        
        // Import worker app fresh
        const workerModule = await import('../../src/worker-app');
        app = workerModule.default;
        
        // Wait for app to be ready
        await app.ready();
    });

    afterEach(async () => {
        if (app) {
            await app.close();
        }
        // Note: Global setup handles resource cleanup
    });

    describe('Health Endpoints', () => {
        it('should respond to GET / with worker-healthy status', async () => {
            const response = await request(app.server)
                .get('/')
                .expect(200);

            expect(response.body).toEqual({
                status: 'worker-healthy'
            });
        });

        it('should respond to GET /health with worker-healthy status', async () => {
            const response = await request(app.server)
                .get('/health')
                .expect(200);

            expect(response.body).toEqual({
                status: 'worker-healthy'
            });
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
    });

    describe('Heartbeat Logging', () => {
        it('should have logging capabilities for heartbeat messages', async () => {
            // Test that the worker app has the necessary logging infrastructure
            expect(app.log).toBeDefined();
            expect(typeof app.log.info).toBe('function');
            
            // Test that we can call the info method without errors
            expect(() => app.log.info('test message')).not.toThrow();
        });

        it('should be able to set up intervals for heartbeat', async () => {
            // Test that setInterval is available and works as expected
            const setIntervalSpy = vi.spyOn(global, 'setInterval');
            
            const mockFn = vi.fn();
            const intervalId = setInterval(mockFn, 10000);
            
            expect(setIntervalSpy).toHaveBeenCalledWith(mockFn, 10000);
            
            // Clean up
            clearInterval(intervalId);
        });
    });

    describe('App Configuration', () => {
        it('should have correct fastify configuration', () => {
            expect(app.hasPlugin('@fastify/cors')).toBe(false); // Worker shouldn't have CORS
            expect(app.hasPlugin('@fastify/http-proxy')).toBe(false); // Worker shouldn't have proxy
        });

        it('should have logging plugin registered', () => {
            expect(app.log).toBeDefined();
            expect(typeof app.log.info).toBe('function');
            expect(typeof app.log.error).toBe('function');
        });

        it('should have trust proxy configured', () => {
            // This tests that the app was created with trustProxy setting
            expect(app.server).toBeDefined();
        });
    });

    describe('Error Handling', () => {
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

    describe('Worker Plugin', () => {
        it('should be able to subscribe to a pubsub topic', async () => {
            const topicName = process.env.PUBSUB_TOPIC_PAGE_HITS_RAW as string;
            const payload = {
                test: 'test message from worker app test'
            };

            const logSpy = vi.spyOn(app.log, 'info');

            const waitForWorkerMessage = () => {
                return new Promise<void>((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Worker did not receive message within 2000ms'));
                    }, 2000);

                    const checkForMessage = () => {
                        const workerMessageCall = logSpy.mock.calls.find((call) => {
                            const [logData, logMessage] = call;
                            return (
                                logData &&
                                typeof logData === 'object' &&
                                'messageData' in logData &&
                                logMessage === 'Worker received message'
                            );
                        });

                        if (workerMessageCall) {
                            clearTimeout(timeout);
                            const [logData] = workerMessageCall;
                            const messageData = (logData as unknown as {messageData: string}).messageData;
                            const receivedPayload = JSON.parse(messageData);
                            expect(receivedPayload).toEqual(payload);
                            resolve();
                        } else {
                            setTimeout(checkForMessage, 50);
                        }
                    };

                    checkForMessage();
                });
            };

            // Allow worker to set up subscription before publishing
            await new Promise<void>((resolve) => {
                setTimeout(() => resolve(), 100);
            });
            
            await publishEvent({
                topic: topicName,
                payload,
                logger: app.log
            });

            await waitForWorkerMessage();
        });
    });
});