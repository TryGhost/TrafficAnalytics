import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import Fastify from 'fastify';
import pino from 'pino';
import {Writable} from 'node:stream';
import loggingPlugin from '../../../src/plugins/logging';

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
            loggerInstance: pino({level: 'debug'}, logStream)
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
            expect(incomingRequestLog).toHaveProperty('trace_id', '105445aa7843bc8bf206b12000100000');
            expect(incomingRequestLog).toHaveProperty('span_id', '1');
            expect(incomingRequestLog).toHaveProperty('trace_flags', '01');
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
            expect(incomingRequestLog).toHaveProperty('trace_id', '4bf92f3577b34da6a3ce929d0e0e4736');
            expect(incomingRequestLog).toHaveProperty('span_id', '00f067aa0ba902b7');
            expect(incomingRequestLog).toHaveProperty('trace_flags', '01');
        });
    });

    describe('production logger mapping', () => {
        it('should emit GCP trace fields when logging through production config', async () => {
            vi.stubEnv('NODE_ENV', 'production');
            vi.stubEnv('LOG_LEVEL', 'info');

            const {getLoggerConfig} = await import('../../../src/utils/logger-config');

            const rawLines: string[] = [];
            const mappingStream = new Writable({
                write(chunk, _encoding, callback) {
                    rawLines.push(chunk.toString());
                    callback();
                }
            });

            const logger = pino(getLoggerConfig(), mappingStream);
            logger.info({
                event: 'trace-mapping',
                trace_id: '105445aa7843bc8bf206b12000100000',
                span_id: '1',
                trace_flags: '01'
            }, 'mapped');

            await new Promise<void>((resolve) => {
                mappingStream.end(() => {
                    resolve();
                });
            });

            const logs = rawLines
                .join('')
                .trim()
                .split('\n')
                .filter(Boolean)
                .map(line => JSON.parse(line) as Record<string, unknown>);
            const mappedLog = logs.find(log => log.event === 'trace-mapping');

            expect(mappedLog).toBeDefined();
            expect(mappedLog).toHaveProperty('logging.googleapis.com/trace', '105445aa7843bc8bf206b12000100000');
            expect(mappedLog).toHaveProperty('logging.googleapis.com/spanId', '1');
            expect(mappedLog).toHaveProperty('logging.googleapis.com/trace_sampled', true);
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
