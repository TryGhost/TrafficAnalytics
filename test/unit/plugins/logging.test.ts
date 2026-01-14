import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import Fastify, {FastifyInstance} from 'fastify';
import loggingPlugin from '../../../src/plugins/logging';

describe('Logging Plugin', () => {
    let app: FastifyInstance;
    let logOutput: Record<string, unknown>[] = [];

    beforeEach(async () => {
        logOutput = [];

        app = Fastify({
            logger: {
                level: 'info',
                transport: {
                    target: 'pino-pretty',
                    options: {
                        sync: true
                    }
                }
            }
        });

        // Capture log output by intercepting the child logger
        const originalChild = app.log.child.bind(app.log);
        app.log.child = (bindings: Record<string, unknown>) => {
            logOutput.push(bindings);
            return originalChild(bindings);
        };

        await app.register(loggingPlugin);

        // Add a test route
        app.get('/test', async () => {
            return {ok: true};
        });

        await app.ready();
    });

    afterEach(async () => {
        if (app) {
            await app.close();
        }
    });

    describe('x-request-id header', () => {
        it('should include requestId in logs when x-request-id header is provided', async () => {
            const requestId = 'test-request-id-12345';

            await app.inject({
                method: 'GET',
                url: '/test',
                headers: {
                    'x-request-id': requestId
                }
            });

            const childLoggerBindings = logOutput.find(
                bindings => bindings.requestId === requestId
            );

            expect(childLoggerBindings).toBeDefined();
            expect(childLoggerBindings?.requestId).toBe(requestId);
        });

        it('should not include requestId in logs when x-request-id header is not provided', async () => {
            await app.inject({
                method: 'GET',
                url: '/test'
            });

            const childLoggerBindings = logOutput.find(
                bindings => 'requestId' in bindings
            );

            expect(childLoggerBindings).toBeUndefined();
        });

        it('should include requestId alongside trace context when both are provided', async () => {
            const requestId = 'test-request-id-67890';
            const traceContext = '105445aa7843bc8bf206b12000100000/1;o=1';

            // Set the project ID for trace context extraction
            const originalProject = process.env.GOOGLE_CLOUD_PROJECT;
            process.env.GOOGLE_CLOUD_PROJECT = 'test-project';

            try {
                await app.inject({
                    method: 'GET',
                    url: '/test',
                    headers: {
                        'x-request-id': requestId,
                        'x-cloud-trace-context': traceContext
                    }
                });

                const childLoggerBindings = logOutput.find(
                    bindings => bindings.requestId === requestId
                );

                expect(childLoggerBindings).toBeDefined();
                expect(childLoggerBindings?.requestId).toBe(requestId);
                expect(childLoggerBindings).toHaveProperty('logging.googleapis.com/trace');
            } finally {
                process.env.GOOGLE_CLOUD_PROJECT = originalProject;
            }
        });
    });
});
