import {z} from 'zod';

// Common types
const StringSchema = z.string();
const NonEmptyStringSchema = z.string().min(1);
// See page-hit-request.ts: UUID-shaped is enough, RFC compliance is not required.
const UUIDSchema = z.guid();
const ISO8601DateTimeSchema = z.iso.datetime({precision: 3});

// Enum types for page hit raw events
const ActionSchema = z.literal('page_hit');
const VersionSchema = z.literal('1');

// Parsed referrer schema
const ParsedReferrerSchema = z.object({
    source: StringSchema.nullable(),
    medium: StringSchema.nullable(),
    url: StringSchema.nullable()
});

export type ParsedReferrer = z.infer<typeof ParsedReferrerSchema>;

// Payload schema for page hit raw events
const PayloadSchema = z.object({
    event_id: StringSchema.optional(),
    member_uuid: z.union([UUIDSchema, z.literal('undefined')]),
    member_status: z.union([NonEmptyStringSchema, z.literal('undefined')]),
    post_uuid: z.union([UUIDSchema, z.literal('undefined')]),
    post_type: z.enum(['null', 'post', 'page']),
    gift_link: StringSchema.nullable().optional(),
    locale: NonEmptyStringSchema,
    location: NonEmptyStringSchema.nullable(),
    referrer: StringSchema.nullable().optional(),
    parsedReferrer: ParsedReferrerSchema.optional(),
    pathname: NonEmptyStringSchema,
    href: StringSchema,
    utm_source: StringSchema.nullable().optional(),
    utm_medium: StringSchema.nullable().optional(),
    utm_campaign: StringSchema.nullable().optional(),
    utm_term: StringSchema.nullable().optional(),
    utm_content: StringSchema.nullable().optional(),
    meta: z.object({
        received_timestamp: ISO8601DateTimeSchema.nullable()
    })
});

// Meta schema for page hit raw events
const MetaSchema = z.object({
    ip: NonEmptyStringSchema,
    'user-agent': NonEmptyStringSchema
});

// Complete page hit raw schema
export const PageHitRawSchema = z.object({
    timestamp: ISO8601DateTimeSchema,
    action: ActionSchema,
    version: VersionSchema,
    site_uuid: UUIDSchema,
    payload: PayloadSchema,
    meta: MetaSchema
});

export type PageHitRaw = z.infer<typeof PageHitRawSchema>;
