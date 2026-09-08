import {Writable} from 'node:stream';
import {afterEach, describe, expect, it, vi} from 'vitest';
import fastify from 'fastify';
import pino from 'pino';
import tinybirdSyncWorkerPlugin from '../../../src/plugins/tinybird-sync-worker-plugin';

describe('Tinybird sync worker plugin', () => {
    afterEach(() => {
        vi.useRealTimers();
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
