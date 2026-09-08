import fastify, {type FastifyInstance} from 'fastify';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import automationWorkerPlugin from '../../../src/plugins/automation-worker-plugin';

describe('automationWorkerPlugin', () => {
    let app: FastifyInstance;

    beforeEach(() => {
        vi.useFakeTimers();
        app = fastify();
    });

    afterEach(async () => {
        await app.close();
        vi.useRealTimers();
    });

    it('logs startup and heartbeat events', async () => {
        const logInfo = vi.spyOn(app.log, 'info');

        app.register(automationWorkerPlugin);
        await app.ready();

        expect(logInfo).toHaveBeenCalledWith({event: 'AutomationWorkerStarted'});

        await vi.advanceTimersByTimeAsync(10000);

        expect(logInfo).toHaveBeenCalledWith({event: 'AutomationWorkerHeartbeat'});
    });

    it('stops the heartbeat when the app closes', async () => {
        app.register(automationWorkerPlugin);
        await app.ready();

        expect(vi.getTimerCount()).toBe(1);

        await app.close();

        expect(vi.getTimerCount()).toBe(0);
    });
});
