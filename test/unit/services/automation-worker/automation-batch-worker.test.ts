import type {Message} from '@google-cloud/pubsub';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import AutomationBatchWorker, {type AutomationTinybirdClients} from '../../../../src/services/automation-worker/AutomationBatchWorker';
import {EventSubscriber} from '../../../../src/services/events/subscriber';

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

const automationRunEventBody = (id = '6a99cd8cb5ac7c0052553383') => ({
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

const automationRunStepEventBody = (id = '6a99cd8cb5ac7c0052553384') => ({
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

    beforeEach(() => {
        vi.clearAllMocks();
        messageId = 0;
        subscriberMocks.close.mockResolvedValue(undefined);
        runClient = {postEventBatch: vi.fn().mockResolvedValue(undefined)};
        stepClient = {postEventBatch: vi.fn().mockResolvedValue(undefined)};
        worker = new AutomationBatchWorker('automation-events-sub', {
            automation_runs: runClient,
            automation_run_steps: stepClient
        } as AutomationTinybirdClients, {concurrency: 3});
        worker.start();
        handleMessage = subscriberMocks.subscribe.mock.calls.at(-1)?.[0];
    });

    afterEach(async () => {
        await worker.stop();
    });

    it('caps outstanding messages at the configured concurrency', () => {
        expect(EventSubscriber).toHaveBeenCalledWith('automation-events-sub', {
            flowControl: {maxMessages: 3, allowExcessMessages: false}
        });
    });

    it('posts each chunk to the Tinybird datasource for its type and acks it', async () => {
        const runChunk = createMessage({type: 'automation_runs', events: [automationRunEventBody(), automationRunEventBody('6a99cd8cb5ac7c0052553385')]});
        const stepChunk = createMessage({type: 'automation_run_steps', events: [automationRunStepEventBody()]});

        await handleMessage(runChunk);
        await handleMessage(stepChunk);

        expect(runClient.postEventBatch).toHaveBeenCalledOnce();
        expect(runClient.postEventBatch).toHaveBeenCalledWith([automationRunEventBody(), automationRunEventBody('6a99cd8cb5ac7c0052553385')]);
        expect(stepClient.postEventBatch).toHaveBeenCalledOnce();
        expect(stepClient.postEventBatch).toHaveBeenCalledWith([automationRunStepEventBody()]);
        [runChunk, stepChunk].forEach((message) => {
            expect(message.ack).toHaveBeenCalledOnce();
            expect(message.nack).not.toHaveBeenCalled();
        });
    });

    it('acks a malformed message without sending anything to Tinybird', async () => {
        const message = createMessage('not-json');

        await handleMessage(message);

        expect(message.ack).toHaveBeenCalledOnce();
        expect(message.nack).not.toHaveBeenCalled();
        expect(runClient.postEventBatch).not.toHaveBeenCalled();
        expect(stepClient.postEventBatch).not.toHaveBeenCalled();
    });

    it('drops rows that fail validation and posts the rest', async () => {
        const good = automationRunEventBody();
        const bad = {...automationRunEventBody('6a99cd8cb5ac7c0052553385'), payload: {email: 'private@example.com'}};
        const message = createMessage({type: 'automation_runs', events: [bad, good]});

        await handleMessage(message);

        expect(runClient.postEventBatch).toHaveBeenCalledWith([good]);
        expect(message.ack).toHaveBeenCalledOnce();
    });

    it('acks a chunk with no valid rows without posting', async () => {
        const message = createMessage({type: 'automation_runs', events: [{id: 'nope'}]});

        await handleMessage(message);

        expect(runClient.postEventBatch).not.toHaveBeenCalled();
        expect(message.ack).toHaveBeenCalledOnce();
    });

    it('nacks the chunk when its Tinybird request fails', async () => {
        runClient.postEventBatch.mockRejectedValue(new Error('Tinybird unavailable'));
        const runChunk = createMessage({type: 'automation_runs', events: [automationRunEventBody()]});
        const stepChunk = createMessage({type: 'automation_run_steps', events: [automationRunStepEventBody()]});

        await handleMessage(runChunk);
        await handleMessage(stepChunk);

        expect(runChunk.nack).toHaveBeenCalledOnce();
        expect(runChunk.ack).not.toHaveBeenCalled();
        expect(stepChunk.ack).toHaveBeenCalledOnce();
        expect(stepChunk.nack).not.toHaveBeenCalled();
    });
});
