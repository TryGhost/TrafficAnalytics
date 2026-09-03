import Ajv, {type ValidateFunction} from 'ajv';
import addFormats from 'ajv-formats';
import fastJson from 'fast-json-stringify';
import type {FastifySchemaCompiler, FastifySerializerCompiler, FastifyTypeProvider} from 'fastify';
import {z, type ZodType} from 'zod';

/**
 * Schemas are authored in Zod, but validated by ajv-generated code.
 *
 * Zod's own `parse` walks the schema tree on every call; ajv compiles a schema once into
 * straight-line JavaScript. Converting at boot gets us Zod's authoring and type inference
 * without paying an interpreter per request.
 */

// Collecting every error lets a hostile payload burn CPU, which is why Fastify pins this
// off on its own instance too.
const allErrors = false;

// The same options Fastify hands its own ajv instance, so replacing the compiler does not
// silently change coercion, default filling, or additionalProperties stripping.
// See @fastify/ajv-compiler/lib/default-ajv-options.
const requestAjv = addFormats(new Ajv({
    coerceTypes: 'array',
    useDefaults: true,
    removeAdditional: true,
    addUsedSchema: false,
    allErrors
}));

// Everything off the HTTP path already arrives as typed JSON, so coercion would only
// destroy information - it rewrites a null utm_source to an empty string to satisfy the
// string branch of a union, for instance.
const dataAjv = addFormats(new Ajv({
    coerceTypes: false,
    useDefaults: false,
    removeAdditional: false,
    addUsedSchema: false,
    allErrors
}));

function toJsonSchema(schema: ZodType, io: 'input' | 'output'): object {
    const json = z.toJSONSchema(schema, {target: 'draft-7', io, unrepresentable: 'any'}) as Record<string, unknown>;

    // ajv is configured for draft-07 already and rejects the 2020-12 dialect marker Zod
    // emits by default.
    delete json.$schema;

    return json;
}

/**
 * Compile a Zod schema into a validator, for use outside the request lifecycle.
 *
 * Throws on invalid input, so callers can treat the return value as the parsed event.
 * Note this validates without transforming: the value is checked in place and returned
 * as-is, so it must already be the right shape.
 */
export function createValidator<T extends ZodType>(schema: T): (data: unknown) => z.output<T> {
    const validate: ValidateFunction = dataAjv.compile(toJsonSchema(schema, 'input'));

    return (data: unknown) => {
        if (!validate(data)) {
            throw new Error(dataAjv.errorsText(validate.errors));
        }

        return data as z.output<T>;
    };
}

// Parsed NDJSON is already structured JSON, so routes consuming it need the same strict,
// non-coercing behavior as other data paths rather than HTTP parameter coercion.
export const dataValidatorCompiler: FastifySchemaCompiler<ZodType> = ({schema}) => {
    return dataAjv.compile(toJsonSchema(schema, 'input'));
};

// Returns ajv's compiled function directly rather than wrapping it. Fastify reads
// `.errors` off it on failure, which is what gives validation failures their
// `body/timestamp must ...` messages and the structured `validation` array the error
// handler logs.
export const validatorCompiler: FastifySchemaCompiler<ZodType> = ({schema}) => {
    return requestAjv.compile(toJsonSchema(schema, 'input'));
};

export const serializerCompiler: FastifySerializerCompiler<ZodType> = ({schema}) => {
    return fastJson(toJsonSchema(schema, 'output') as Parameters<typeof fastJson>[0]);
};

/**
 * Types come from the Zod schema; validation comes from ajv.
 *
 * `input` and `output` only diverge where a schema has a transform, which JSON Schema
 * cannot express and `toJSONSchema` drops silently - keep those out of schemas and do the
 * work in a preHandler instead.
 */
export interface ZodTypeProvider extends FastifyTypeProvider {
    validator: this['schema'] extends ZodType ? z.input<this['schema']> : unknown;
    serializer: this['schema'] extends ZodType ? z.output<this['schema']> : unknown;
}
