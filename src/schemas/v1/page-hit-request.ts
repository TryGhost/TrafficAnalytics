import {Static, Type} from '@sinclair/typebox';
import {randomUUID} from 'crypto';
import {FastifyRequest} from 'fastify';

// Common types
const StringSchema = Type.String();
const NonEmptyStringSchema = Type.String({
    minLength: 1,
    pattern: '^.*\\S.*$' // At least one non-whitespace character
});
const UUIDSchema = Type.String({format: 'uuid'});
const ISO8601DateTimeSchema = Type.String({
    // `format` alone accepts any RFC 3339 timestamp, including offsets and second-precision.
    // The pattern narrows that to the canonical `Date.prototype.toISOString()` shape, which
    // is what we store. Both are needed: the pattern fixes the shape, the format rejects
    // impossible dates like 2026-02-30 that still match it.
    format: 'date-time',
    pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$'
});
const VersionSchema = Type.Literal('1');

// Enum types
const AnalyticsEventNameSchema = Type.Union([
    Type.Literal('analytics_events'),
    Type.Literal('analytics_events_test')
]);
const ActionSchema = Type.Literal('page_hit');
const ContentTypeSchema = Type.Literal('application/json');

// Accept any value. Clients send all sorts of things here, and anything unusable is
// replaced by resolveEventId rather than rejected.
export const EventIdSchema = Type.Any();

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
export const PageHitRequestQueryParamsSchema = Type.Object({
    token: Type.Optional(NonEmptyStringSchema),
    name: AnalyticsEventNameSchema
}, {
    additionalProperties: Type.String()
});

export type PageHitRequestQueryParamsType = Static<typeof PageHitRequestQueryParamsSchema>;

// Headers schema
export const PageHitRequestHeadersSchema = Type.Object({
    'x-site-uuid': UUIDSchema,
    'content-type': ContentTypeSchema,
    'user-agent': NonEmptyStringSchema,
    'x-ghost-analytics-start': Type.Optional(StringSchema),
    referer: Type.Optional(StringSchema)
}, {
    additionalProperties: Type.Union([StringSchema, Type.Array(StringSchema)])
});

export type PageHitRequestHeadersType = Static<typeof PageHitRequestHeadersSchema>;

// Parsed referrer schema
const ParsedReferrerSchema = Type.Object({
    source: Type.Union([StringSchema, Type.Null()]),
    medium: Type.Union([StringSchema, Type.Null()]),
    url: Type.Union([StringSchema, Type.Null()])
});

// Payload schema
export const PageHitRequestPayloadSchema = Type.Object({
    event_id: Type.Optional(EventIdSchema),
    'user-agent': NonEmptyStringSchema,
    locale: NonEmptyStringSchema,
    location: Type.Union([NonEmptyStringSchema, Type.Null()]),
    referrer: Type.Optional(Type.Union([StringSchema, Type.Null()])),
    parsedReferrer: Type.Optional(ParsedReferrerSchema),
    pathname: NonEmptyStringSchema,
    href: Type.String(),
    site_uuid: UUIDSchema,
    post_uuid: Type.Union([UUIDSchema, Type.Literal('undefined')]),
    post_type: Type.Union([Type.Literal('null'), Type.Literal('post'), Type.Literal('page')]),
    gift_link: Type.Optional(Type.Union([StringSchema, Type.Null()])),
    member_uuid: Type.Union([UUIDSchema, Type.Literal('undefined')]),
    member_status: Type.Union([NonEmptyStringSchema, Type.Literal('undefined')]),
    utm_source: Type.Optional(Type.Union([StringSchema, Type.Null()])),
    utm_medium: Type.Optional(Type.Union([StringSchema, Type.Null()])),
    utm_campaign: Type.Optional(Type.Union([StringSchema, Type.Null()])),
    utm_term: Type.Optional(Type.Union([StringSchema, Type.Null()])),
    utm_content: Type.Optional(Type.Union([StringSchema, Type.Null()]))
}, {
    additionalProperties: true // Allow processors to add os, browser, device, etc.
});

// Request body schema
export const PageHitRequestBodySchema = Type.Object({
    timestamp: ISO8601DateTimeSchema,
    action: ActionSchema,
    version: VersionSchema,
    session_id: Type.Optional(StringSchema),
    payload: PageHitRequestPayloadSchema
});

export type PageHitRequestBodyType = Static<typeof PageHitRequestBodySchema>;

// Complete request schema
export const PageHitRequestSchema = Type.Object({
    querystring: PageHitRequestQueryParamsSchema,
    headers: PageHitRequestHeadersSchema,
    body: PageHitRequestBodySchema
});

export interface PageHitRequestType extends FastifyRequest {
    query: Static<typeof PageHitRequestQueryParamsSchema>;
    headers: Static<typeof PageHitRequestHeadersSchema>;
    body: Static<typeof PageHitRequestBodySchema>;
}

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
