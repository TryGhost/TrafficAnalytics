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

export const AutomationRunEventSchema = EventEnvelopeSchema.extend({
    type: z.literal('automation_runs'),
    payload: AutomationRunPayloadSchema
});

export const AutomationRunStepEventSchema = EventEnvelopeSchema.extend({
    type: z.literal('automation_run_steps'),
    payload: AutomationRunStepPayloadSchema
});

export const AutomationEventSchema = z.discriminatedUnion('type', [
    AutomationRunEventSchema,
    AutomationRunStepEventSchema
]);

export const AutomationEventBatchSchema = z.array(AutomationEventSchema).min(1);
export const AutomationRequestBodySchema = z.union([
    AutomationEventSchema,
    AutomationEventBatchSchema
]);

export type AutomationRunEvent = z.infer<typeof AutomationRunEventSchema>;
export type AutomationRunStepEvent = z.infer<typeof AutomationRunStepEventSchema>;
export type AutomationEvent = z.infer<typeof AutomationEventSchema>;
export type AutomationRequestBody = z.infer<typeof AutomationRequestBodySchema>;
