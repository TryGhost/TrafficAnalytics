import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import Fastify from 'fastify';
import pino from 'pino';
import {Writable} from 'node:stream';
import loggingPlugin from '../../../src/plugins/logging';
import {getLoggerConfig} from '../../../src/utils/logger-config';

describe('Logging Plugin', () => {
    let app: ReturnType<typeof Fastify>;
    let logLines: string[];
    let logBuffer: string;

    const parseLogs = (): Record<string, unknown>[] => {
        const parsedLogs: Record<string, unknown>[] = [];

        if (logBuffer.trim().length > 0) {
            throw new Error(`Incomplete non-empty log buffer found: ${logBuffer}`);
        }

        for (const line of logLines) {
            if (line.trim().length === 0) {
                continue;
            }

            try {
                parsedLogs.push(JSON.parse(line) as Record<string, unknown>);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                throw new Error(`Non-JSON log line emitted: ${line}\nParse error: ${message}`);
            }
        }

        return parsedLogs;
    };

    beforeEach(async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('LOG_LEVEL', 'debug');
        vi.stubEnv('GOOGLE_CLOUD_PROJECT', 'test-project');

        logLines = [];
        logBuffer = '';

        const logStream = new Writable({
            write(chunk, _encoding, callback) {
                logBuffer += chunk.toString();
                const lines = logBuffer.split('\n');
                logBuffer = lines.pop() ?? '';
                logLines.push(...lines.filter(Boolean));
                callback();
            }
        });

        app = Fastify({
            loggerInstance: pino(getLoggerConfig(), logStream)
        });

        await app.register(loggingPlugin);

        // Add a test route
        app.get('/test', async () => {
            return {ok: true};
        });
        app.post('/test', async () => {
            return {ok: true};
        });

        await app.ready();
    });

    afterEach(async () => {
        vi.unstubAllEnvs();

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

            const incomingRequestLog = parseLogs().find(
                log => log.event === 'IncomingRequest'
            );

            expect(incomingRequestLog).toBeDefined();
            expect(incomingRequestLog?.requestId).toBe(requestId);
        });

        it('should not include requestId in logs when x-request-id header is not provided', async () => {
            await app.inject({
                method: 'GET',
                url: '/test'
            });

            const incomingRequestLog = parseLogs().find(
                log => log.event === 'IncomingRequest'
            );

            expect(incomingRequestLog).toBeDefined();
            expect(incomingRequestLog).not.toHaveProperty('requestId');
        });

        it('should include requestId alongside trace context when both are provided', async () => {
            const requestId = 'test-request-id-67890';
            const traceContext = '105445aa7843bc8bf206b12000100000/1;o=1';

            await app.inject({
                method: 'GET',
                url: '/test',
                headers: {
                    'x-request-id': requestId,
                    'x-cloud-trace-context': traceContext
                }
            });

            const incomingRequestLog = parseLogs().find(
                log => log.event === 'IncomingRequest'
            );

            expect(incomingRequestLog).toBeDefined();
            expect(incomingRequestLog?.requestId).toBe(requestId);
            expect(incomingRequestLog).toHaveProperty('logging.googleapis.com/trace', 'projects/test-project/traces/105445aa7843bc8bf206b12000100000');
            expect(incomingRequestLog).toHaveProperty('logging.googleapis.com/spanId', '1');
            expect(incomingRequestLog).toHaveProperty('logging.googleapis.com/trace_sampled', true);
        });

        it('should add W3C traceparent fields when cloud trace header is not present', async () => {
            await app.inject({
                method: 'GET',
                url: '/test',
                headers: {
                    traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
                }
            });

            const incomingRequestLog = parseLogs().find(
                log => log.event === 'IncomingRequest'
            );

            expect(incomingRequestLog).toBeDefined();
            expect(incomingRequestLog).toHaveProperty('logging.googleapis.com/trace', 'projects/test-project/traces/4bf92f3577b34da6a3ce929d0e0e4736');
            expect(incomingRequestLog).toHaveProperty('logging.googleapis.com/spanId', '00f067aa0ba902b7');
            expect(incomingRequestLog).toHaveProperty('logging.googleapis.com/trace_sampled', true);
        });
    });

    describe('x-site-uuid header', () => {
        it('should include siteUuid in IncomingRequest log when x-site-uuid header is provided', async () => {
            const siteUuid = '12345678-1234-1234-1234-123456789012';

            await app.inject({
                method: 'GET',
                url: '/test',
                headers: {
                    'x-site-uuid': siteUuid
                }
            });

            const incomingRequestLog = parseLogs().find(
                log => log.event === 'IncomingRequest'
            );

            expect(incomingRequestLog).toBeDefined();
            expect(incomingRequestLog?.siteUuid).toBe(siteUuid);
        });

        it('should not include siteUuid in IncomingRequest log when x-site-uuid header is not provided', async () => {
            await app.inject({
                method: 'GET',
                url: '/test'
            });

            const incomingRequestLog = parseLogs().find(
                log => log.event === 'IncomingRequest'
            );

            expect(incomingRequestLog).toBeDefined();
            expect(incomingRequestLog).not.toHaveProperty('siteUuid');
        });
    });

    describe('request body logging', () => {
        it('should log request body for requests over 600 KB', async () => {
            const largeBody = {
                payload: 'x'.repeat((600 * 1024) + 1)
            };

            await app.inject({
                method: 'POST',
                url: '/test',
                payload: largeBody
            });

            const incomingRequestBodyLog = parseLogs().find(
                log => log.event === 'IncomingRequestBody'
            );

            expect(incomingRequestBodyLog).toBeDefined();
            expect(incomingRequestBodyLog?.requestBodySize).toBeGreaterThan(600 * 1024);
            expect(incomingRequestBodyLog?.parsedBodySize).toBeGreaterThan(600 * 1024);
            expect(incomingRequestBodyLog?.bodySummary).toEqual({
                type: 'object',
                keyCount: 1,
                keys: {
                    payload: {
                        type: 'string',
                        length: (600 * 1024) + 1
                    }
                }
            });
        });

        it('should not log request body for requests at or under 600 KB', async () => {
            await app.inject({
                method: 'POST',
                url: '/test',
                payload: {
                    payload: 'x'.repeat((600 * 1024) - 200)
                }
            });

            const incomingRequestBodyLog = parseLogs().find(
                log => log.event === 'IncomingRequestBody'
            );

            expect(incomingRequestBodyLog).toBeUndefined();
        });
    });
});
