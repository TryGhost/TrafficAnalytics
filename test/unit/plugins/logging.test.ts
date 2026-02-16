import {describe, it, expect, beforeEach, afterEach} from 'vitest';
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
            loggerInstance: pino({level: 'info'}, logStream)
        });

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

                const incomingRequestLog = parseLogs().find(
                    log => log.event === 'IncomingRequest'
                );

                expect(incomingRequestLog).toBeDefined();
                expect(incomingRequestLog?.requestId).toBe(requestId);
                expect(incomingRequestLog).toHaveProperty(['logging.googleapis.com/trace']);
            } finally {
                process.env.GOOGLE_CLOUD_PROJECT = originalProject;
            }
        });
    });
});
