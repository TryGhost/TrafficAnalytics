import type {Message} from '@google-cloud/pubsub';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import TinybirdSyncBatchWorker, {type TinybirdSyncClients} from '../../../../src/services/tinybird-sync-worker/TinybirdSyncBatchWorker';

const subscriberMocks = vi.hoisted(() => ({close: vi.fn(), subscribe: vi.fn()}));

vi.mock('../../../../src/services/events/subscriber', () => ({
    EventSubscriber: vi.fn(function () {
        return subscriberMocks;
    })
}));

vi.mock('../../../../src/utils/logger', () => ({
    default: {debug: vi.fn(), error: vi.fn(), info: vi.fn()}
}));

const SITE_UUID = '45d99892-6304-4251-a75d-2d9ff9c5b81f';
const runEvent = (id = '6a99cd8cb5ac7c0052553383') => ({
    type: 'automation_runs' as const,
    site_uuid: SITE_UUID,
    id,
    updated_at: '2026-09-03T19:42:04.000Z',
    payload: {
        id,
        automation_id: '6a99cd6cb5ac7c0052553378',
        created_at: '2026-09-03T19:42:04.000Z',
        updated_at: '2026-09-03T19:42:04.000Z',
        site_uuid: SITE_UUID
    }
});
const stepEvent = (id = '6a99cd8cb5ac7c0052553384') => ({
    type: 'automation_run_steps' as const,
    site_uuid: SITE_UUID,
    id,
    updated_at: '2026-09-03T19:42:04.000Z',
    payload: {
        id,
        automation_run_id: '6a99cd8cb5ac7c0052553383',
        automation_action_revision_id: '6a99cd7db5ac7c005255337a',
        status: 'pending',
        step_attempts: 0,
        ready_at: '2026-09-04T19:42:04.000Z',
        started_at: null,
        finished_at: null,
        created_at: '2026-09-03T19:42:04.000Z',
        updated_at: '2026-09-03T19:42:04.000Z',
        site_uuid: SITE_UUID
    }
});

let messageId = 0;
const message = (data: unknown): Message => {
    messageId += 1;
    return {
        id: `message-${messageId}`,
        data: Buffer.from(typeof data === 'string' ? data : JSON.stringify(data)),
        ack: vi.fn(),
        nack: vi.fn()
    } as unknown as Message;
};

describe('TinybirdSyncBatchWorker', () => {
    let worker: TinybirdSyncBatchWorker;
    let handleMessage: (value: Message) => Promise<void>;
    let runClient: {postEventBatch: ReturnType<typeof vi.fn>};
    let stepClient: {postEventBatch: ReturnType<typeof vi.fn>};

    const start = (batchSize = 2, flushInterval = 60_000) => {
        worker = new TinybirdSyncBatchWorker('tinybird-sync-sub', {
            automation_runs: runClient,
            automation_run_steps: stepClient
        } as TinybirdSyncClients, {batchSize, flushInterval});
        worker.start();
        handleMessage = subscriberMocks.subscribe.mock.calls.at(-1)?.[0];
    };

    beforeEach(() => {
        vi.clearAllMocks();
        messageId = 0;
        subscriberMocks.close.mockResolvedValue(undefined);
        runClient = {postEventBatch: vi.fn().mockResolvedValue(undefined)};
        stepClient = {postEventBatch: vi.fn().mockResolvedValue(undefined)};
        start();
    });

    afterEach(async () => {
        await worker.stop();
        vi.useRealTimers();
    });

    it('keeps event types in separate batches and strips routing type', async () => {
        const runs = [message(runEvent()), message(runEvent('6a99cd8cb5ac7c0052553385'))];
        const steps = [message(stepEvent()), message(stepEvent('6a99cd8cb5ac7c0052553386'))];

        await handleMessage(runs[0]);
        await handleMessage(steps[0]);
        await handleMessage(runs[1]);

        expect(runClient.postEventBatch).toHaveBeenCalledOnce();
        expect(stepClient.postEventBatch).not.toHaveBeenCalled();
        expect(runClient.postEventBatch).toHaveBeenCalledWith([
            expect.not.objectContaining({type: expect.anything()}),
            expect.not.objectContaining({type: expect.anything()})
        ]);

        await handleMessage(steps[1]);
        expect(stepClient.postEventBatch).toHaveBeenCalledOnce();
        [...runs, ...steps].forEach(value => expect(value.ack).toHaveBeenCalledOnce());
    });

    it('nacks invalid messages without sending them to Tinybird', async () => {
        const value = message('not-json');
        await handleMessage(value);
        expect(value.nack).toHaveBeenCalledOnce();
        expect(value.ack).not.toHaveBeenCalled();
        expect(runClient.postEventBatch).not.toHaveBeenCalled();
        expect(stepClient.postEventBatch).not.toHaveBeenCalled();
    });

    it('nacks messages from a failed event-type batch without affecting the other event-type batch', async () => {
        runClient.postEventBatch.mockRejectedValue(new Error('Tinybird unavailable'));
        const runs = [message(runEvent()), message(runEvent('6a99cd8cb5ac7c0052553385'))];
        const steps = [message(stepEvent()), message(stepEvent('6a99cd8cb5ac7c0052553386'))];
        for (const value of [...runs, ...steps]) {
            await handleMessage(value);
        }
        runs.forEach(value => expect(value.nack).toHaveBeenCalledOnce());
        steps.forEach(value => expect(value.ack).toHaveBeenCalledOnce());
    });

    it('flushes partial batches when stopped', async () => {
        const run = message(runEvent());
        const step = message(stepEvent());
        await handleMessage(run);
        await handleMessage(step);
        await worker.stop();
        expect(runClient.postEventBatch).toHaveBeenCalledOnce();
        expect(stepClient.postEventBatch).toHaveBeenCalledOnce();
        expect(run.ack).toHaveBeenCalledOnce();
        expect(step.ack).toHaveBeenCalledOnce();
    });

    it('stops only once', async () => {
        await worker.stop();
        await worker.stop();

        expect(subscriberMocks.close).toHaveBeenCalledOnce();
    });

    it('flushes partial batches on configured interval', async () => {
        await worker.stop();
        vi.useFakeTimers();
        start(2, 1000);
        const run = message(runEvent());
        const step = message(stepEvent());
        await handleMessage(run);
        await handleMessage(step);
        await vi.advanceTimersByTimeAsync(1000);
        expect(runClient.postEventBatch).toHaveBeenCalledOnce();
        expect(stepClient.postEventBatch).toHaveBeenCalledOnce();
    });
});
