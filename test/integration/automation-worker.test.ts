import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import AutomationBatchWorker, {type AutomationTinybirdClients} from '../../src/services/automation-worker/AutomationBatchWorker';
import {publishEvent} from '../../src/services/events/publisher';
import type {TinybirdEvent} from '../../src/services/tinybird/client';
import {createMockLogger} from '../utils/mock-logger';

const AUTOMATION_SUBSCRIPTION = process.env.PUBSUB_SUBSCRIPTION_AUTOMATION_EVENTS || 'test-traffic-analytics-automation-events-sub';
const AUTOMATION_TOPIC = process.env.PUBSUB_TOPIC_AUTOMATION_EVENTS || 'test-traffic-analytics-automation-events';
const SITE_UUID = '45d99892-6304-4251-a75d-2d9ff9c5b81f';

const automationRunEvent = {
    type: 'automation_runs' as const,
    site_uuid: SITE_UUID,
    id: '6a99cd8cb5ac7c0052553383',
    updated_at: '2026-09-03T19:42:04.000Z',
    payload: {
        id: '6a99cd8cb5ac7c0052553383',
        automation_id: '6a99cd6cb5ac7c0052553378',
        created_at: '2026-09-03T19:42:04.000Z',
        updated_at: '2026-09-03T19:42:04.000Z',
        site_uuid: SITE_UUID
    }
};

const automationRunStepEvent = {
    type: 'automation_run_steps' as const,
    site_uuid: SITE_UUID,
    id: '6a99cd8cb5ac7c0052553384',
    updated_at: '2026-09-03T19:42:04.000Z',
    payload: {
        id: '6a99cd8cb5ac7c0052553384',
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
};

describe('automation worker', () => {
    let worker: AutomationBatchWorker;
    let runBatch: Promise<TinybirdEvent[]>;
    let stepBatch: Promise<TinybirdEvent[]>;

    beforeEach(() => {
        let resolveRunBatch: (events: TinybirdEvent[]) => void = () => {};
        let resolveStepBatch: (events: TinybirdEvent[]) => void = () => {};
        runBatch = new Promise(resolve => {
            resolveRunBatch = resolve;
        });
        stepBatch = new Promise(resolve => {
            resolveStepBatch = resolve;
        });

        const tinybirdClients = {
            automation_runs: {
                postEventBatch: vi.fn(async (events: TinybirdEvent[]) => resolveRunBatch(events))
            },
            automation_run_steps: {
                postEventBatch: vi.fn(async (events: TinybirdEvent[]) => resolveStepBatch(events))
            }
        } as AutomationTinybirdClients;

        worker = new AutomationBatchWorker(AUTOMATION_SUBSCRIPTION, tinybirdClients, {
            batchSize: 1,
            flushInterval: 60_000
        });
        worker.start();
    });

    afterEach(async () => {
        await worker.stop();
    });

    it('routes Pub/Sub events into separate Tinybird batches', async () => {
        const logger = createMockLogger();
        await Promise.all([
            publishEvent({topic: AUTOMATION_TOPIC, payload: automationRunEvent, logger}),
            publishEvent({topic: AUTOMATION_TOPIC, payload: automationRunStepEvent, logger})
        ]);

        const [receivedRunBatch, receivedStepBatch] = await Promise.all([runBatch, stepBatch]);

        expect(receivedRunBatch).toEqual([{
            site_uuid: automationRunEvent.site_uuid,
            id: automationRunEvent.id,
            updated_at: automationRunEvent.updated_at,
            payload: automationRunEvent.payload
        }]);
        expect(receivedStepBatch).toEqual([{
            site_uuid: automationRunStepEvent.site_uuid,
            id: automationRunStepEvent.id,
            updated_at: automationRunStepEvent.updated_at,
            payload: automationRunStepEvent.payload
        }]);
    });
});
