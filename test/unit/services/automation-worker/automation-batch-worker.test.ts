import type {Message} from '@google-cloud/pubsub';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import AutomationBatchWorker, {type AutomationTinybirdClients} from '../../../../src/services/automation-worker/AutomationBatchWorker';

const subscriberMocks = vi.hoisted(() => ({
    close: vi.fn(),
    subscribe: vi.fn()
}));

vi.mock('../../../../src/services/events/subscriber', () => ({
    EventSubscriber: vi.fn(function () {
        return subscriberMocks;
    })
}));

vi.mock('../../../../src/utils/logger', () => ({
    default: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn()
    }
}));

const SITE_UUID = '45d99892-6304-4251-a75d-2d9ff9c5b81f';

const automationRunEvent = (id = '6a99cd8cb5ac7c0052553383') => ({
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

const automationRunStepEvent = (id = '6a99cd8cb5ac7c0052553384') => ({
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
const createMessage = (data: unknown): Message => {
    messageId += 1;
    return {
        id: `message-${messageId}`,
        data: Buffer.from(typeof data === 'string' ? data : JSON.stringify(data)),
        ack: vi.fn(),
        nack: vi.fn()
    } as unknown as Message;
};

describe('AutomationBatchWorker', () => {
    let worker: AutomationBatchWorker;
    let handleMessage: (message: Message) => Promise<void>;
    let runClient: {postEventBatch: ReturnType<typeof vi.fn>};
    let stepClient: {postEventBatch: ReturnType<typeof vi.fn>};

    const startWorker = (batchSize = 2, flushInterval = 60_000) => {
        worker = new AutomationBatchWorker('automation-events-sub', {
            automation_runs: runClient,
            automation_run_steps: stepClient
        } as AutomationTinybirdClients, {batchSize, flushInterval});
        worker.start();
        handleMessage = subscriberMocks.subscribe.mock.calls.at(-1)?.[0];
    };

    beforeEach(() => {
        vi.clearAllMocks();
        messageId = 0;
        subscriberMocks.close.mockResolvedValue(undefined);
        runClient = {postEventBatch: vi.fn().mockResolvedValue(undefined)};
        stepClient = {postEventBatch: vi.fn().mockResolvedValue(undefined)};
        startWorker();
    });

    afterEach(async () => {
        await worker.stop();
        vi.useRealTimers();
    });

    it('keeps event types in separate batches and strips the routing type', async () => {
        const runMessage1 = createMessage(automationRunEvent());
        const stepMessage1 = createMessage(automationRunStepEvent());
        const runMessage2 = createMessage(automationRunEvent('6a99cd8cb5ac7c0052553385'));
        const stepMessage2 = createMessage(automationRunStepEvent('6a99cd8cb5ac7c0052553386'));

        await handleMessage(runMessage1);
        await handleMessage(stepMessage1);
        await handleMessage(runMessage2);

        expect(runClient.postEventBatch).toHaveBeenCalledOnce();
        expect(stepClient.postEventBatch).not.toHaveBeenCalled();
        expect(runClient.postEventBatch).toHaveBeenCalledWith([
            expect.not.objectContaining({type: expect.anything()}),
            expect.not.objectContaining({type: expect.anything()})
        ]);

        await handleMessage(stepMessage2);

        expect(stepClient.postEventBatch).toHaveBeenCalledOnce();
        expect(stepClient.postEventBatch).toHaveBeenCalledWith([
            expect.not.objectContaining({type: expect.anything()}),
            expect.not.objectContaining({type: expect.anything()})
        ]);
        [runMessage1, runMessage2, stepMessage1, stepMessage2].forEach((message) => {
            expect(message.ack).toHaveBeenCalledOnce();
            expect(message.nack).not.toHaveBeenCalled();
        });
    });

    it('acks invalid messages without sending them to Tinybird', async () => {
        const message = createMessage('not-json');

        await handleMessage(message);

        expect(message.ack).toHaveBeenCalledOnce();
        expect(message.nack).not.toHaveBeenCalled();
        expect(runClient.postEventBatch).not.toHaveBeenCalled();
        expect(stepClient.postEventBatch).not.toHaveBeenCalled();
    });

    it('nacks only the event type whose Tinybird request fails', async () => {
        runClient.postEventBatch.mockRejectedValue(new Error('Tinybird unavailable'));
        const runMessages = [
            createMessage(automationRunEvent()),
            createMessage(automationRunEvent('6a99cd8cb5ac7c0052553385'))
        ];
        const stepMessages = [
            createMessage(automationRunStepEvent()),
            createMessage(automationRunStepEvent('6a99cd8cb5ac7c0052553386'))
        ];

        for (const message of [...runMessages, ...stepMessages]) {
            await handleMessage(message);
        }

        runMessages.forEach((message) => {
            expect(message.nack).toHaveBeenCalledOnce();
            expect(message.ack).not.toHaveBeenCalled();
        });
        stepMessages.forEach((message) => {
            expect(message.ack).toHaveBeenCalledOnce();
            expect(message.nack).not.toHaveBeenCalled();
        });
    });

    it('flushes both partial batches when stopped', async () => {
        const runMessage = createMessage(automationRunEvent());
        const stepMessage = createMessage(automationRunStepEvent());
        await handleMessage(runMessage);
        await handleMessage(stepMessage);

        await worker.stop();

        expect(runClient.postEventBatch).toHaveBeenCalledOnce();
        expect(stepClient.postEventBatch).toHaveBeenCalledOnce();
        expect(runMessage.ack).toHaveBeenCalledOnce();
        expect(stepMessage.ack).toHaveBeenCalledOnce();
    });

    it('flushes both event types on the configured interval', async () => {
        await worker.stop();
        vi.useFakeTimers();
        startWorker(2, 1000);
        const runMessage = createMessage(automationRunEvent());
        const stepMessage = createMessage(automationRunStepEvent());
        await handleMessage(runMessage);
        await handleMessage(stepMessage);

        await vi.advanceTimersByTimeAsync(1000);

        expect(runClient.postEventBatch).toHaveBeenCalledOnce();
        expect(stepClient.postEventBatch).toHaveBeenCalledOnce();
        expect(runMessage.ack).toHaveBeenCalledOnce();
        expect(stepMessage.ack).toHaveBeenCalledOnce();
    });
});
