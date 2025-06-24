import {Type, FormatRegistry} from '@sinclair/typebox';
import validator from '@tryghost/validator';

// Register format validators for runtime validation using @tryghost/validator
FormatRegistry.Set('uuid', (value) => {
    return validator.isUUID(value);
});

FormatRegistry.Set('uri', (value) => {
    return validator.isURL(value);
});

FormatRegistry.Set('date-time', (value) => {
    // Use native Date parsing which handles ISO8601 formats properly
    const date = new Date(value);
    return !isNaN(date.getTime()) && date.toISOString() === value;
});

// Common types
const StringSchema = Type.String();
const NonEmptyStringSchema = Type.String({minLength: 1});
const UUIDSchema = Type.String({format: 'uuid'});
const URLSchema = Type.String({format: 'uri'});
const ISO8601DateTimeSchema = Type.String({
    format: 'date-time'
});

// Enum types
const AnalyticsEventNameSchema = Type.Union([
    Type.Literal('analytics_events'),
    Type.Literal('analytics_events_test')
]);
const ActionSchema = Type.Literal('page_hit');
const ContentTypeSchema = Type.Literal('application/json');

// Query parameters schema
export const QueryParamsSchema = Type.Object({
    token: Type.Optional(NonEmptyStringSchema),
    name: AnalyticsEventNameSchema
}, {
    additionalProperties: Type.String()
});

// Headers schema
export const HeadersSchema = Type.Object({
    'x-site-uuid': UUIDSchema,
    'content-type': ContentTypeSchema,
    'user-agent': StringSchema,
    referer: Type.Optional(StringSchema)
}, {
    additionalProperties: Type.Union([StringSchema, Type.Array(StringSchema)])
});

// Payload schema
export const PayloadSchema = Type.Object({
    'user-agent': NonEmptyStringSchema,
    locale: NonEmptyStringSchema,
    location: Type.Union([NonEmptyStringSchema, Type.Null()]),
    referrer: Type.Union([StringSchema, Type.Null()]),
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
export const BodySchema = Type.Object({
    timestamp: ISO8601DateTimeSchema,
    action: ActionSchema,
    version: StringSchema,
    session_id: Type.Optional(StringSchema),
    payload: PayloadSchema
});

// Complete request schema
export const PageHitRawRequestSchema = Type.Object({
    querystring: QueryParamsSchema,
    headers: HeadersSchema,
    body: BodySchema
});