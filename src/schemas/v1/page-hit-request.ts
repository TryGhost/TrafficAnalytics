import {z} from 'zod';
import {randomUUID} from 'crypto';
import {FastifyRequest} from 'fastify';

// Common types
const StringSchema = z.string();
const NonEmptyStringSchema = z.string().min(1).regex(/^.*\S.*$/); // At least one non-whitespace character
// `guid`, not `uuid`: we only require UUID-shaped values, not RFC-compliant version and
// variant nibbles. Sites in the wild send IDs that fail the stricter check.
const UUIDSchema = z.guid();
// `precision: 3` pins this to the canonical `Date.prototype.toISOString()` shape, which is
// what we store. Without it, offsets and second-precision timestamps would be accepted.
const ISO8601DateTimeSchema = z.iso.datetime({precision: 3});
const VersionSchema = z.literal('1');

// Enum types
const AnalyticsEventNameSchema = z.enum(['analytics_events', 'analytics_events_test']);
const ActionSchema = z.literal('page_hit');
const ContentTypeSchema = z.literal('application/json');

// Accept any value. Clients send all sorts of things here, and anything unusable is
// replaced by resolveEventId rather than rejected.
export const EventIdSchema = z.any();

/**
 * Resolve the client-supplied event ID to the one we store.
 *
 * Any non-empty string is kept as-is, so IDs that are not valid UUIDs still round-trip.
 * Empty strings, missing values and non-strings get a fresh UUID.
 */
export const resolveEventId = (value: unknown): string => {
    if (typeof value === 'string' && value.length > 0) {
        return value;
    }

    return randomUUID();
};

// Query parameters schema
export const PageHitRequestQueryParamsSchema = z.object({
    token: NonEmptyStringSchema.optional(),
    name: AnalyticsEventNameSchema
}).catchall(StringSchema);

export type PageHitRequestQueryParamsType = z.infer<typeof PageHitRequestQueryParamsSchema>;

// Headers schema
export const PageHitRequestHeadersSchema = z.object({
    'x-site-uuid': UUIDSchema,
    'content-type': ContentTypeSchema,
    'user-agent': NonEmptyStringSchema,
    'x-ghost-analytics-start': StringSchema.optional(),
    referer: StringSchema.optional()
}).catchall(z.union([StringSchema, z.array(StringSchema)]));

export type PageHitRequestHeadersType = z.infer<typeof PageHitRequestHeadersSchema>;

// Parsed referrer schema
const ParsedReferrerSchema = z.object({
    source: StringSchema.nullable(),
    medium: StringSchema.nullable(),
    url: StringSchema.nullable()
});

// Payload schema
// `looseObject` allows processors to add os, browser, device, etc.
export const PageHitRequestPayloadSchema = z.looseObject({
    event_id: EventIdSchema.optional(),
    'user-agent': NonEmptyStringSchema,
    locale: NonEmptyStringSchema,
    location: NonEmptyStringSchema.nullable(),
    referrer: StringSchema.nullable().optional(),
    parsedReferrer: ParsedReferrerSchema.optional(),
    pathname: NonEmptyStringSchema,
    href: StringSchema,
    site_uuid: UUIDSchema,
    post_uuid: z.union([UUIDSchema, z.literal('undefined')]),
    post_type: z.enum(['null', 'post', 'page']),
    gift_link: StringSchema.nullable().optional(),
    member_uuid: z.union([UUIDSchema, z.literal('undefined')]),
    member_status: z.union([NonEmptyStringSchema, z.literal('undefined')]),
    utm_source: StringSchema.nullable().optional(),
    utm_medium: StringSchema.nullable().optional(),
    utm_campaign: StringSchema.nullable().optional(),
    utm_term: StringSchema.nullable().optional(),
    utm_content: StringSchema.nullable().optional()
});

// Request body schema
export const PageHitRequestBodySchema = z.object({
    timestamp: ISO8601DateTimeSchema,
    action: ActionSchema,
    version: VersionSchema,
    session_id: StringSchema.optional(),
    payload: PageHitRequestPayloadSchema
});

export type PageHitRequestBodyType = z.infer<typeof PageHitRequestBodySchema>;

// Complete request schema
export const PageHitRequestSchema = z.object({
    querystring: PageHitRequestQueryParamsSchema,
    headers: PageHitRequestHeadersSchema,
    body: PageHitRequestBodySchema
});

// Built from FastifyRequest's own generic rather than hand-written, so it matches the
// request type Fastify infers for the route exactly - including the way it merges declared
// headers with IncomingHttpHeaders.
export type PageHitRequestType = FastifyRequest<{
    Querystring: PageHitRequestQueryParamsType;
    Headers: PageHitRequestHeadersType;
    Body: PageHitRequestBodyType;
}>;

/**
 * Apply payload defaults and settle the event ID.
 *
 * Fastify has already validated the body, query and headers against the schemas above
 * using ajv, so this does not revalidate them - it only does the two things a JSON
 * Schema cannot express.
 */
export const populateAndTransformPageHitRequest = async (request: PageHitRequestType): Promise<PageHitRequestType> => {
    const payload = {
        ...PageHitRequestPayloadDefaults,
        ...request.body.payload
    };

    payload.event_id = resolveEventId(payload.event_id);
    request.body.payload = payload;

    return request;
};

export const PageHitRequestPayloadDefaults = {
    event_id: '',
    locale: '',
    location: null,
    referrer: null,
    parsedReferrer: {
        source: null,
        medium: null,
        url: null
    },
    pathname: '',
    href: '',
    site_uuid: '',
    post_uuid: 'undefined',
    post_type: 'null',
    gift_link: null,
    member_uuid: 'undefined',
    member_status: 'undefined',
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_term: null,
    utm_content: null
};
