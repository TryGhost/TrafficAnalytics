import {describe, it, expect, afterEach, vi} from 'vitest';
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

        const config = getLoggerConfig();

        expect(config.level).toBe(process.env.LOG_LEVEL || 'info');
        expect(config.transport).toMatchObject({
            target: 'pino-pretty'
        });
        expect(config.serializers).toHaveProperty('req');
        expect(config.serializers).toHaveProperty('res');
        expect(config.serializers).toHaveProperty('err');
    });

    it('should return gcp logger config outside development and test', () => {
        vi.stubEnv('NODE_ENV', 'production');

        const config = getLoggerConfig();

        expect(config.level).toBe(process.env.LOG_LEVEL || 'info');
        expect(config.formatters).toHaveProperty('log');
        expect(config.serializers).toHaveProperty('err');
    });
});
