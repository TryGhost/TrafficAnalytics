import type {FastifyBaseLogger} from 'fastify';

/**
 * Creates a mock Fastify logger for testing
 */
export function createMockLogger(): FastifyBaseLogger {
    return {
        info: () => {},
        child: () => createMockLogger(),
        level: 'info',
        fatal: () => {},
        error: () => {},
        warn: () => {},
        debug: () => {},
        trace: () => {},
        silent: () => {}
    } as FastifyBaseLogger;
}