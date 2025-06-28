import {Type, Static} from '@sinclair/typebox';

// Common types
const StringSchema = Type.String();
const NonEmptyStringSchema = Type.String({minLength: 1});
const UUIDSchema = Type.String({format: 'uuid'});
const URLSchema = Type.String({format: 'uri'});
const ISO8601DateTimeSchema = Type.String({
    format: 'date-time'
});

// Enum types for page hit raw events
const ActionSchema = Type.Literal('page_hit');
const VersionSchema = Type.Literal('1');

// Parsed referrer schema
const ParsedReferrerSchema = Type.Object({
    source: Type.Union([StringSchema, Type.Null()]),
    medium: Type.Union([StringSchema, Type.Null()]),
    url: Type.Union([StringSchema, Type.Null()])
});

// Payload schema for page hit raw events
const PayloadSchema = Type.Object({
    event_id: Type.Optional(StringSchema),
    member_uuid: Type.Union([UUIDSchema, Type.Literal('undefined')]),
    member_status: Type.Union([NonEmptyStringSchema, Type.Literal('undefined')]),
    post_uuid: Type.Union([UUIDSchema, Type.Literal('undefined')]),
    post_type: Type.Union([Type.Literal('null'), Type.Literal('post'), Type.Literal('page')]),
    locale: NonEmptyStringSchema,
    location: Type.Union([NonEmptyStringSchema, Type.Null()]),
    referrer: Type.Optional(Type.Union([StringSchema, Type.Null()])),
    parsedReferrer: Type.Optional(ParsedReferrerSchema),
    pathname: NonEmptyStringSchema,
    href: URLSchema
});

// Meta schema for page hit raw events
const MetaSchema = Type.Object({
    ip: NonEmptyStringSchema,
    'user-agent': NonEmptyStringSchema
});

// Complete page hit raw schema
export const PageHitRawSchema = Type.Object({
    timestamp: ISO8601DateTimeSchema,
    action: ActionSchema,
    version: VersionSchema,
    site_uuid: UUIDSchema,
    payload: PayloadSchema,
    meta: MetaSchema
});

export type PageHitRaw = Static<typeof PageHitRawSchema>;