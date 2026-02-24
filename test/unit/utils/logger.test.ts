import {describe, it, expect, afterEach, vi} from 'vitest';
import pino from 'pino';
import {Writable} from 'node:stream';
import {getLoggerConfig} from '../../../src/utils/logger-config';

describe('Logger Config', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

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
        expect(config.serializers).toHaveProperty('err');
    });

    it('should return gcp logger config outside development and test', () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('LOG_LEVEL', 'info');

        const config = getLoggerConfig();

        expect(config.level).toBe('info');
        expect(config.formatters).toHaveProperty('log');
        expect(config.serializers).toHaveProperty('err');
    });

    it('should emit GCP severity field instead of numeric level in production logs', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('LOG_LEVEL', 'info');

        let rawLog = '';
        const stream = new Writable({
            write(chunk, _encoding, callback) {
                rawLog += chunk.toString();
                callback();
            }
        });

        const logger = pino(getLoggerConfig(), stream);
        logger.info({event: 'test'}, 'hello');

        await new Promise<void>((resolve) => {
            stream.end(() => {
                resolve();
            });
        });

        const logs = rawLog.trim()
            .split('\n')
            .filter(Boolean)
            .map(line => JSON.parse(line) as Record<string, unknown>);

        const appLog = logs.find(log => log.event === 'test');

        expect(appLog).toBeDefined();
        expect(appLog).toHaveProperty('severity', 'INFO');
        expect(appLog).not.toHaveProperty('level');
    });
});
