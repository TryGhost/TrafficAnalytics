import {Static, Type} from '@sinclair/typebox';
import {FastifyRequest} from 'fastify';

// Common types
const StringSchema = Type.String();
const NonEmptyStringSchema = Type.String({minLength: 1});
const UUIDSchema = Type.String({format: 'uuid'});
const URLSchema = Type.String({format: 'uri'});
const ISO8601DateTimeSchema = Type.String({
    format: 'date-time'
});
const VersionSchema = Type.Literal('1');

// Enum types
const AnalyticsEventNameSchema = Type.Union([
    Type.Literal('analytics_events'),
    Type.Literal('analytics_events_test')
]);
const ActionSchema = Type.Literal('page_hit');
const ContentTypeSchema = Type.Literal('application/json');

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
    'user-agent': StringSchema,
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
    event_id: Type.Optional(StringSchema),
    'user-agent': NonEmptyStringSchema,
    locale: NonEmptyStringSchema,
    location: Type.Union([NonEmptyStringSchema, Type.Null()]),
    referrer: Type.Optional(Type.Union([StringSchema, Type.Null()])),
    parsedReferrer: Type.Optional(ParsedReferrerSchema),
    pathname: NonEmptyStringSchema,
    href: URLSchema,
    site_uuid: UUIDSchema,
    post_uuid: Type.Union([UUIDSchema, Type.Literal('undefined')]),
    post_type: Type.Union([Type.Literal('null'), Type.Literal('post'), Type.Literal('page')]),
    member_uuid: Type.Union([UUIDSchema, Type.Literal('undefined')]),
    member_status: Type.Union([NonEmptyStringSchema, Type.Literal('undefined')])
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