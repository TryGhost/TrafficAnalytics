import {describe, expect, it} from 'vitest';
import {
    AutomationEventBatchSchema,
    AutomationEventSchema,
    AutomationRunEventSchema,
    AutomationRunStepEventSchema
} from '../../../../src/schemas';

const SITE_UUID = '45d99892-6304-4251-a75d-2d9ff9c5b81f';

const automationRunEvent = () => ({
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
});

const automationRunStepEvent = () => ({
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
});

describe('automation event schemas', () => {
    it('accepts a complete automation event batch', () => {
        expect(AutomationEventBatchSchema.safeParse([
            automationRunEvent(),
            automationRunStepEvent()
        ]).success).toBe(true);
    });

    it('rejects an empty automation event batch', () => {
        expect(AutomationEventBatchSchema.safeParse([]).success).toBe(false);
    });

    it('accepts an automation run event', () => {
        expect(AutomationRunEventSchema.safeParse(automationRunEvent()).success).toBe(true);
    });

    it('accepts an automation run step event with nullable lifecycle timestamps', () => {
        expect(AutomationRunStepEventSchema.safeParse(automationRunStepEvent()).success).toBe(true);
    });

    it('accepts populated lifecycle timestamps', () => {
        const event = automationRunStepEvent();

        expect(AutomationRunStepEventSchema.safeParse({
            ...event,
            payload: {
                ...event.payload,
                started_at: '2026-09-04T19:42:05.000Z',
                finished_at: '2026-09-04T19:42:06.000Z'
            }
        }).success).toBe(true);
    });

    it('rejects a non-ISO timestamp', () => {
        const event = automationRunEvent();
        event.updated_at = '2026-09-03 19:42:04';

        expect(AutomationRunEventSchema.safeParse(event).success).toBe(false);
    });

    it('rejects an invalid site UUID', () => {
        const event = automationRunEvent();
        event.site_uuid = 'not-a-uuid';

        expect(AutomationRunEventSchema.safeParse(event).success).toBe(false);
    });

    it.each([
        ['envelope id', (event: ReturnType<typeof automationRunEvent>) => {
            event.id = 'not-an-object-id';
        }],
        ['payload id', (event: ReturnType<typeof automationRunEvent>) => {
            event.payload.id = 'not-an-object-id';
        }],
        ['automation id', (event: ReturnType<typeof automationRunEvent>) => {
            event.payload.automation_id = 'not-an-object-id';
        }]
    ])('rejects an invalid BSON ObjectId in the %s', (_label, mutate) => {
        const event = automationRunEvent();
        mutate(event);

        expect(AutomationRunEventSchema.safeParse(event).success).toBe(false);
    });

    it.each([
        ['payload id', (event: ReturnType<typeof automationRunStepEvent>) => {
            event.payload.id = 'not-an-object-id';
        }],
        ['automation run id', (event: ReturnType<typeof automationRunStepEvent>) => {
            event.payload.automation_run_id = 'not-an-object-id';
        }],
        ['automation action revision id', (event: ReturnType<typeof automationRunStepEvent>) => {
            event.payload.automation_action_revision_id = 'not-an-object-id';
        }]
    ])('rejects an invalid BSON ObjectId in the run step %s', (_label, mutate) => {
        const event = automationRunStepEvent();
        mutate(event);

        expect(AutomationRunStepEventSchema.safeParse(event).success).toBe(false);
    });

    it('rejects payload fields not included in the schema', () => {
        const event = automationRunEvent();

        expect(AutomationRunEventSchema.safeParse({
            ...event,
            payload: {...event.payload, email: 'private@example.com'}
        }).success).toBe(false);
    });

    it('selects the payload schema using the event type', () => {
        expect(AutomationEventSchema.safeParse({
            ...automationRunEvent(),
            type: 'automation_run_steps'
        }).success).toBe(false);
    });
});
