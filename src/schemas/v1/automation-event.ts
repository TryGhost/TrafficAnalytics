import {z} from 'zod';

const NonEmptyStringSchema = z.string().min(1);
export const BSONObjectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/);
const ISO8601DateTimeSchema = z.iso.datetime();
// See page-hit-request.ts: UUID-shaped is enough, RFC compliance is not required.
const UUIDSchema = z.guid();

export const AutomationRunPayloadSchema = z.strictObject({
    id: BSONObjectIdSchema,
    automation_id: BSONObjectIdSchema,
    created_at: ISO8601DateTimeSchema,
    updated_at: ISO8601DateTimeSchema,
    site_uuid: UUIDSchema
});

export const AutomationRunStepPayloadSchema = z.strictObject({
    id: BSONObjectIdSchema,
    automation_run_id: BSONObjectIdSchema,
    automation_action_revision_id: BSONObjectIdSchema,
    status: NonEmptyStringSchema,
    step_attempts: z.number().int().nonnegative(),
    ready_at: ISO8601DateTimeSchema,
    started_at: ISO8601DateTimeSchema.nullable(),
    finished_at: ISO8601DateTimeSchema.nullable(),
    created_at: ISO8601DateTimeSchema,
    updated_at: ISO8601DateTimeSchema,
    site_uuid: UUIDSchema
});

const EventEnvelopeSchema = z.strictObject({
    site_uuid: UUIDSchema,
    id: BSONObjectIdSchema,
    updated_at: ISO8601DateTimeSchema
});

const AutomationRunEventBodySchema = EventEnvelopeSchema.extend({
    payload: AutomationRunPayloadSchema
});

const AutomationRunStepEventBodySchema = EventEnvelopeSchema.extend({
    payload: AutomationRunStepPayloadSchema
});

export const AutomationRunEventSchema = AutomationRunEventBodySchema.extend({
    type: z.literal('automation_runs')
});

export const AutomationRunStepEventSchema = AutomationRunStepEventBodySchema.extend({
    type: z.literal('automation_run_steps')
});

export const AutomationEventSchema = z.discriminatedUnion('type', [
    AutomationRunEventSchema,
    AutomationRunStepEventSchema
]);

// The Pub/Sub message shape: one type, many events, so a sync of thousands of rows is a
// few hundred messages rather than one per row.
export const AutomationEventChunkSchema = z.discriminatedUnion('type', [
    z.strictObject({
        type: z.literal('automation_runs'),
        events: z.array(AutomationRunEventBodySchema).min(1)
    }),
    z.strictObject({
        type: z.literal('automation_run_steps'),
        events: z.array(AutomationRunStepEventBodySchema).min(1)
    })
]);

export const AutomationEventBatchSchema = z.array(AutomationEventSchema).min(1);
export const AutomationRequestBodySchema = z.union([
    AutomationEventSchema,
    AutomationEventBatchSchema
]);

export type AutomationRunEvent = z.infer<typeof AutomationRunEventSchema>;
export type AutomationRunStepEvent = z.infer<typeof AutomationRunStepEventSchema>;
export type AutomationEvent = z.infer<typeof AutomationEventSchema>;
export type AutomationEventChunk = z.infer<typeof AutomationEventChunkSchema>;
export type AutomationRequestBody = z.infer<typeof AutomationRequestBodySchema>;
