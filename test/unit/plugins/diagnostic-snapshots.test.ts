import {afterEach, describe, expect, it, vi} from 'vitest';
import Fastify from 'fastify';
import {performance} from 'node:perf_hooks';
import diagnostics from '../../../src/plugins/diagnostic-snapshots';
import {ActiveOperations, activePublishes} from '../../../src/utils/active-operations';

describe('diagnostic snapshots', () => {
    afterEach(() => {
        vi.useRealTimers();
    });
    it('tracks oldest outstanding operations and supports repeated completion', () => {
        const now = vi.spyOn(performance, 'now');
        now.mockReturnValue(100);
        const operations = new ActiveOperations();
        const first = operations.start();
        now.mockReturnValue(150);
        const second = operations.start();
        now.mockReturnValue(200);
        expect(operations.snapshot()).toEqual({count: 2, oldestAgeMs: 100});
        first();
        first();
        expect(operations.snapshot()).toEqual({count: 1, oldestAgeMs: 50});
        second();
        expect(operations.snapshot()).toEqual({count: 0, oldestAgeMs: 0});
    });

    it('reports active work and elapsed windows, then releases its timer on close', async () => {
        vi.useFakeTimers({toFake: ['setInterval', 'clearInterval']});
        const now = vi.spyOn(performance, 'now').mockReturnValue(0);
        const app = Fastify();
        const log = vi.spyOn(app.log, 'info');
        app.register(diagnostics);
        let release!: () => void;
        let entered!: () => void;
        const started = new Promise<void>((resolve) => {
            entered = resolve;
        });
        app.get('/slow', async () => {
            entered();
            await new Promise<void>((resolve) => {
                release = resolve;
            });
            return 'ok';
        });
        await app.ready();
        const response = app.inject('/slow');
        const completed = response.then(result => result);
        await started;
        const finishPublish = activePublishes.start();
        now.mockReturnValue(35_000);
        vi.advanceTimersByTime(10_000);
        expect(log).toHaveBeenLastCalledWith(expect.objectContaining({
            event: 'DiagnosticSnapshot',
            intervalMs: 35_000,
            missedIntervals: 2,
            processStartId: expect.any(String),
            requests: {count: 1, oldestAgeMs: 35_000},
            publishes: {count: 1, oldestAgeMs: 35_000},
            memoryBytes: expect.objectContaining({rss: expect.any(Number)}),
            cpu: expect.objectContaining({userMs: expect.any(Number)}),
            eventLoop: expect.objectContaining({utilization: expect.any(Number)}),
            gc: {count: 0, totalMs: 0, maxMs: 0}
        }));
        finishPublish();
        release();
        await completed;
        now.mockReturnValue(45_000);
        vi.advanceTimersByTime(10_000);
        expect(log).toHaveBeenLastCalledWith(expect.objectContaining({
            requests: {count: 0, oldestAgeMs: 0},
            publishes: {count: 0, oldestAgeMs: 0}
        }));
        await app.close();
        const count = log.mock.calls.length;
        vi.advanceTimersByTime(10_000);
        expect(log).toHaveBeenCalledTimes(count);
        expect(vi.getTimerCount()).toBe(0);
    });
});
