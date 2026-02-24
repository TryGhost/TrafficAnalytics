import {describe, it, expect, afterEach, beforeEach, vi} from 'vitest';
import pino, {type Logger} from 'pino';
import {Writable} from 'node:stream';
import errors from '@tryghost/errors';
import {getLoggerConfig} from '../../../src/utils/logger-config';

type JsonLog = Record<string, unknown>;

// GCP structured logging severities:
// https://docs.cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#logseverity
const GCP_SEVERITIES = new Set([
    'DEFAULT',
    'DEBUG',
    'INFO',
    'NOTICE',
    'WARNING',
    'ERROR',
    'CRITICAL',
    'ALERT',
    'EMERGENCY'
]);

function createLoggerHarness(): {
    logger: Logger;
    flushLogs: () => Promise<JsonLog[]>;
    } {
    let rawLog = '';
    const stream = new Writable({
        write(chunk, _encoding, callback) {
            rawLog += chunk.toString();
            callback();
        }
    });

    const logger = pino(getLoggerConfig(), stream);

    return {
        logger,
        async flushLogs() {
            await new Promise<void>((resolve) => {
                stream.end(() => {
                    resolve();
                });
            });

            return rawLog.trim()
                .split('\n')
                .filter(Boolean)
                .map(line => JSON.parse(line) as JsonLog);
        }
    };
}

function findLogByEvent(logs: JsonLog[], event: string): JsonLog | undefined {
    return logs.find(log => log.event === event);
}

describe('Logger Config', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe('environment config', () => {
        it('should disable logging in test environment', () => {
            vi.stubEnv('NODE_ENV', 'testing');

            expect(getLoggerConfig()).toEqual({level: 'silent'});
        });

        it('should return pretty logger config in development', () => {
            vi.stubEnv('NODE_ENV', 'development');
            vi.stubEnv('LOG_LEVEL', 'warn');

            const config = getLoggerConfig();

            expect(config.level).toBe('warn');
            expect(config.transport).toMatchObject({
                target: 'pino-pretty'
            });
            expect(config.serializers).toHaveProperty('req');
            expect(config.serializers).toHaveProperty('res');
        });

        it('should return gcp logger config outside development and test', () => {
            vi.stubEnv('NODE_ENV', 'production');
            vi.stubEnv('LOG_LEVEL', 'info');

            const config = getLoggerConfig();

            expect(config.level).toBe('info');
            expect(config.formatters).toHaveProperty('log');
            expect(config.serializers).toBeUndefined();
        });
    });

    describe('production logging output', () => {
        beforeEach(() => {
            vi.stubEnv('NODE_ENV', 'production');
            vi.stubEnv('LOG_LEVEL', 'info');
        });

        it('should emit GCP severity field in production logs', async () => {
            const {logger, flushLogs} = createLoggerHarness();
            logger.info({event: 'test'}, 'hello');

            const logs = await flushLogs();
            const appLog = findLogByEvent(logs, 'test');

            expect(appLog).toBeDefined();
            expect(appLog).toHaveProperty('severity', 'INFO');
        });

        const serviceContextCases = [
            {
                name: 'should include service context from K_SERVICE and K_REVISION',
                event: 'service-context-k-service-k-revision',
                env: {
                    K_SERVICE: 'test-service',
                    K_REVISION: 'test-rev'
                },
                expectedService: 'test-service',
                expectedVersion: 'test-rev',
                versionAssertion: 'exact'
            },
            {
                name: 'should use npm package version when K_REVISION is not set',
                event: 'service-context-npm-version-fallback',
                env: {
                    K_SERVICE: 'test-service',
                    K_REVISION: '',
                    npm_package_version: '9.9.9-test'
                },
                expectedService: 'test-service',
                expectedVersion: '9.9.9-test',
                versionAssertion: 'exact'
            },
            {
                name: 'should omit service context version when K_REVISION and npm package version are missing',
                event: 'service-context-no-version',
                env: {
                    K_SERVICE: 'test-service',
                    K_REVISION: '',
                    npm_package_version: ''
                },
                expectedService: 'test-service',
                expectedVersion: undefined,
                versionAssertion: 'absent'
            },
            {
                name: 'should include worker service context when WORKER_MODE is true and K_SERVICE is missing',
                event: 'service-context-worker',
                env: {
                    WORKER_MODE: 'true',
                    K_REVISION: 'worker-rev'
                },
                expectedService: 'analytics-worker',
                expectedVersion: 'worker-rev',
                versionAssertion: 'exact'
            },
            {
                name: 'should not use worker service context when WORKER_MODE is false',
                event: 'service-context-worker-mode-false',
                env: {
                    K_SERVICE: '',
                    WORKER_MODE: 'false'
                },
                expectedService: 'analytics-service',
                expectedVersion: undefined,
                versionAssertion: 'ignore'
            },
            {
                name: 'should fall back to analytics-service when worker mode and K_SERVICE are missing',
                event: 'service-context-default-service',
                env: {
                    K_SERVICE: '',
                    WORKER_MODE: ''
                },
                expectedService: 'analytics-service',
                expectedVersion: undefined,
                versionAssertion: 'ignore'
            }
        ] as const;

        for (const testCase of serviceContextCases) {
            it(testCase.name, async () => {
                for (const [key, value] of Object.entries(testCase.env)) {
                    vi.stubEnv(key, value);
                }

                const {logger, flushLogs} = createLoggerHarness();
                logger.info({event: testCase.event}, 'hello');

                const logs = await flushLogs();
                const appLog = findLogByEvent(logs, testCase.event);

                expect(appLog).toBeDefined();
                expect(appLog).toHaveProperty('serviceContext.service', testCase.expectedService);

                if (testCase.versionAssertion === 'exact') {
                    expect(appLog).toHaveProperty('serviceContext.version', testCase.expectedVersion);
                } else if (testCase.versionAssertion === 'absent') {
                    expect(appLog).not.toHaveProperty('serviceContext.version');
                }
            });
        }

        it('should map each pino level to the expected GCP severity in production logs', async () => {
            vi.stubEnv('LOG_LEVEL', 'trace');

            const expectedByEvent = {
                trace_event: 'DEBUG',
                debug_event: 'DEBUG',
                info_event: 'INFO',
                warn_event: 'WARNING',
                error_event: 'ERROR',
                fatal_event: 'CRITICAL'
            } as const;

            const {logger, flushLogs} = createLoggerHarness();
            logger.trace({event: 'trace_event'}, 'trace');
            logger.debug({event: 'debug_event'}, 'debug');
            logger.info({event: 'info_event'}, 'info');
            logger.warn({event: 'warn_event'}, 'warn');
            logger.error({event: 'error_event'}, 'error');
            logger.fatal({event: 'fatal_event'}, 'fatal');

            const logs = await flushLogs();

            for (const [event, expectedSeverity] of Object.entries(expectedByEvent)) {
                const log = findLogByEvent(logs, event);

                expect(log).toBeDefined();
                expect(GCP_SEVERITIES.has(String(log?.severity))).toBe(true);
                expect(log).toHaveProperty('severity', expectedSeverity);
            }
        });

        it('should map the msg field to message in production logs', async () => {
            const {logger, flushLogs} = createLoggerHarness();
            logger.info({event: 'message_field_test'}, 'hello world');

            const logs = await flushLogs();
            const appLog = findLogByEvent(logs, 'message_field_test');

            expect(appLog).toBeDefined();
            expect(appLog).toHaveProperty('message', 'hello world');
            expect(appLog).not.toHaveProperty('msg');
        });

        it('should map generic trace fields to GCP trace fields', async () => {
            const {logger, flushLogs} = createLoggerHarness();
            logger.info({
                event: 'trace-map',
                trace_id: '105445aa7843bc8bf206b12000100000',
                span_id: '1',
                trace_flags: '01'
            }, 'trace mapping');

            const logs = await flushLogs();
            const appLog = findLogByEvent(logs, 'trace-map');

            expect(appLog).toBeDefined();
            expect(appLog).toHaveProperty('logging.googleapis.com/trace', '105445aa7843bc8bf206b12000100000');
            expect(appLog).toHaveProperty('logging.googleapis.com/spanId', '1');
            expect(appLog).toHaveProperty('logging.googleapis.com/trace_sampled', true);
            expect(appLog).not.toHaveProperty('trace_id');
            expect(appLog).not.toHaveProperty('span_id');
            expect(appLog).not.toHaveProperty('trace_flags');
        });

        it('should omit trace_sampled when trace_flags indicates unsampled trace', async () => {
            const {logger, flushLogs} = createLoggerHarness();
            logger.info({
                event: 'trace-unsampled',
                trace_id: '105445aa7843bc8bf206b12000100000',
                span_id: '1',
                trace_flags: '00'
            }, 'trace mapping');

            const logs = await flushLogs();
            const appLog = findLogByEvent(logs, 'trace-unsampled');

            expect(appLog).toBeDefined();
            expect(appLog).toHaveProperty('logging.googleapis.com/trace', '105445aa7843bc8bf206b12000100000');
            expect(appLog).toHaveProperty('logging.googleapis.com/spanId', '1');
            expect(appLog).not.toHaveProperty('logging.googleapis.com/trace_sampled');
        });

        it('should serialize native errors with error reporting fields', async () => {
            const {logger, flushLogs} = createLoggerHarness();
            logger.error({event: 'native-error', err: new Error('boom')}, 'request failed');

            const logs = await flushLogs();
            const appLog = findLogByEvent(logs, 'native-error');

            expect(appLog).toBeDefined();
            expect(appLog).toHaveProperty('err.message', 'boom');
            expect(appLog).toHaveProperty('err.stack');
            expect(appLog).toHaveProperty('stack_trace');
            expect(appLog).toHaveProperty('message', 'request failed');
        });

        it('should serialize Ghost errors with Ghost-specific fields', async () => {
            const {logger, flushLogs} = createLoggerHarness();
            const ghostError = new errors.IncorrectUsageError({
                message: 'bad input',
                context: 'invalid request payload'
            });

            logger.error({event: 'ghost-error', err: ghostError}, 'request failed');

            const logs = await flushLogs();
            const appLog = findLogByEvent(logs, 'ghost-error');

            expect(appLog).toBeDefined();
            expect(appLog).toHaveProperty('err.message', 'bad input');
            expect(appLog).toHaveProperty('err.errorType', 'IncorrectUsageError');
            expect(appLog).toHaveProperty('err.statusCode', 400);
            expect(appLog).toHaveProperty('err.context', 'invalid request payload');
            expect(appLog).toHaveProperty('stack_trace');
        });
    });
});
