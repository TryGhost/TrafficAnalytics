import {z} from 'zod';

const NonEmptyStringSchema = z.string().min(1);
const BSONObjectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/);
const ISO8601DateTimeSchema = z.iso.datetime();
// See page-hit-request.ts: UUID-shaped is enough, RFC compliance is not required.
const UUIDSchema = z.guid();

const AutomationRunPayloadSchema = z.strictObject({
    id: BSONObjectIdSchema,
    automation_id: BSONObjectIdSchema,
    created_at: ISO8601DateTimeSchema,
    updated_at: ISO8601DateTimeSchema,
    site_uuid: UUIDSchema
});

const AutomationRunStepPayloadSchema = z.strictObject({
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

const AutomationRunEventSchema = EventEnvelopeSchema.extend({
    type: z.literal('automation_runs'),
    payload: AutomationRunPayloadSchema
});

const AutomationRunStepEventSchema = EventEnvelopeSchema.extend({
    type: z.literal('automation_run_steps'),
    payload: AutomationRunStepPayloadSchema
});

export const TinybirdSyncEventSchema = z.discriminatedUnion('type', [
    AutomationRunEventSchema,
    AutomationRunStepEventSchema
]);

export const TinybirdSyncRequestBodySchema = z.array(TinybirdSyncEventSchema).min(1);

export type TinybirdSyncEvent = z.infer<typeof TinybirdSyncEventSchema>;
export type TinybirdSyncRequestBody = z.infer<typeof TinybirdSyncRequestBodySchema>;
