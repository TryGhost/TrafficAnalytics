import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import fastify from 'fastify';
import pino from 'pino';
import {Writable} from 'node:stream';
import tinybirdSyncWorkerPlugin from '../../../src/plugins/tinybird-sync-worker-plugin';

const mocks = vi.hoisted(() => ({
    clientConfigs: [] as unknown[],
    start: vi.fn(),
    stop: vi.fn(),
    workerConstructor: vi.fn()
}));

vi.mock('../../../src/services/tinybird/client', () => ({
    TinybirdClient: class TinybirdClient {
        constructor(config: unknown) {
            mocks.clientConfigs.push(config);
        }
    }
}));

vi.mock('../../../src/services/tinybird-sync-worker/TinybirdSyncBatchWorker', () => ({
    default: vi.fn(function (subscriptionName: string, clients: unknown, config: unknown) {
        mocks.workerConstructor(subscriptionName, clients, config);
        return {start: mocks.start, stop: mocks.stop};
    })
}));

describe('Tinybird sync worker plugin', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.clientConfigs.length = 0;
        mocks.stop.mockResolvedValue(undefined);
        vi.stubEnv('PUBSUB_SUBSCRIPTION_TINYBIRD_SYNC', 'tinybird-sync-sub');
        vi.stubEnv('PROXY_TARGET', 'https://api.tinybird.co/v0/events');
        vi.stubEnv('TINYBIRD_TRACKER_TOKEN', 'test-token');
        vi.stubEnv('TINYBIRD_SYNC_BATCH_SIZE', '25');
        vi.stubEnv('TINYBIRD_SYNC_BATCH_FLUSH_INTERVAL_MS', '500');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.useRealTimers();
    });

    it('starts worker with one Tinybird client per event type and stops it on close', async () => {
        const app = fastify();
        app.register(tinybirdSyncWorkerPlugin);
        await app.ready();

        expect(mocks.clientConfigs).toEqual([
            expect.objectContaining({datasource: 'automation_run_events'}),
            expect.objectContaining({datasource: 'automation_run_step_events'})
        ]);
        expect(mocks.workerConstructor).toHaveBeenCalledWith(
            'tinybird-sync-sub',
            {
                automation_runs: expect.anything(),
                automation_run_steps: expect.anything()
            },
            {batchSize: 25, flushInterval: 500}
        );
        expect(mocks.start).toHaveBeenCalledOnce();

        await app.close();
        expect(mocks.stop).toHaveBeenCalledOnce();
    });

    it('logs startup and recurring heartbeat events', async () => {
        vi.useFakeTimers();
        const logLines: string[] = [];
        const destination = new Writable({
            write(chunk, _encoding, callback) {
                logLines.push(chunk.toString());
                callback();
            }
        });
        const app = fastify({loggerInstance: pino(destination)});

        app.register(tinybirdSyncWorkerPlugin);
        await app.ready();

        expect(logLines.map(line => JSON.parse(line))).toContainEqual(
            expect.objectContaining({event: 'TinybirdSyncWorkerStarted'})
        );

        await vi.advanceTimersByTimeAsync(10000);

        expect(logLines.map(line => JSON.parse(line))).toContainEqual(
            expect.objectContaining({event: 'TinybirdSyncWorkerHeartbeat'})
        );

        await app.close();
    });
});
