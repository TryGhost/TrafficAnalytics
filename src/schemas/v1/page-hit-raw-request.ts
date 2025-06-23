import {Type, FormatRegistry} from '@sinclair/typebox';

// Register format validators for runtime validation
FormatRegistry.Set('uuid', (value) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
});

FormatRegistry.Set('uri', (value) => {
    try {
        new URL(value);
        return true;
    } catch {
        return false;
    }
});

FormatRegistry.Set('date-time', (value) => {
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    if (!iso8601Regex.test(value)) {
        return false;
    }
    const date = new Date(value);
    return !isNaN(date.getTime());
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
    location: NonEmptyStringSchema,
    referrer: Type.Union([URLSchema, Type.Null()]),
    pathname: NonEmptyStringSchema,
    href: URLSchema,
    site_uuid: UUIDSchema,
    post_uuid: Type.Union([UUIDSchema, Type.Literal('undefined')]),
    post_type: Type.Union([Type.Literal('null'), Type.Literal('post'), Type.Literal('page')]),
    member_uuid: Type.Union([UUIDSchema, Type.Literal('undefined')]),
    member_status: NonEmptyStringSchema
});

// Request body schema
export const BodySchema = Type.Object({
    timestamp: ISO8601DateTimeSchema,
    action: ActionSchema,
    version: StringSchema,
    payload: PayloadSchema
});

// Complete request schema
export const PageHitRawRequestSchema = Type.Object({
    querystring: QueryParamsSchema,
    headers: HeadersSchema,
    body: BodySchema
});