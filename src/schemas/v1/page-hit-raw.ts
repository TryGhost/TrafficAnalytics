import {Type, FormatRegistry, Static} from '@sinclair/typebox';
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

// Enum types for page hit raw events
const ActionSchema = Type.Literal('page_hit');
const VersionSchema = Type.Literal('1');

// Payload schema for page hit raw events
const PayloadSchema = Type.Object({
    member_uuid: Type.Union([UUIDSchema, Type.Literal('undefined')]),
    member_status: Type.Union([NonEmptyStringSchema, Type.Literal('undefined')]),
    post_uuid: Type.Union([UUIDSchema, Type.Literal('undefined')]),
    post_type: Type.Union([Type.Literal('null'), Type.Literal('post'), Type.Literal('page')]),
    locale: NonEmptyStringSchema,
    location: Type.Union([NonEmptyStringSchema, Type.Null()]),
    referrer: Type.Union([StringSchema, Type.Null()]),
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