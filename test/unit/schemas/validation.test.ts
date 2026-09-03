import {describe, it, expect} from 'vitest';
import {z} from 'zod';
import {
    createValidator,
    validatorCompiler,
    AutomationEventSchema,
    AutomationRequestBodySchema,
    PageHitRawSchema,
    PageHitRequestBodySchema,
    PageHitRequestHeadersSchema,
    PageHitRequestQueryParamsSchema
} from '../../../src/schemas';

const UUID = '940b73e9-4952-4752-b23d-9486f999c47e';

function validAutomationEvent() {
    return {
        type: 'automation_runs',
        site_uuid: UUID,
        id: '6a99cd8cb5ac7c0052553383',
        updated_at: '2026-09-03T19:42:04.000Z',
        payload: {
            id: '6a99cd8cb5ac7c0052553383',
            automation_id: '6a99cd6cb5ac7c0052553378',
            created_at: '2026-09-03T19:42:04.000Z',
            updated_at: '2026-09-03T19:42:04.000Z',
            site_uuid: UUID
        }
    };
}

function validRawEvent(): Record<string, unknown> & {payload: Record<string, unknown>} {
    return {
        timestamp: '2025-04-14T22:16:06.095Z',
        action: 'page_hit',
        version: '1',
        site_uuid: UUID,
        payload: {
            event_id: UUID,
            member_uuid: 'undefined',
            member_status: 'free',
            post_uuid: 'undefined',
            post_type: 'null',
            locale: 'en-US',
            location: 'US',
            pathname: '/',
            href: 'https://example.com/',
            meta: {received_timestamp: null}
        },
        meta: {ip: '127.0.0.1', 'user-agent': 'Mozilla/5.0 Test Browser'}
    };
}

function validRequestBody() {
    return {
        timestamp: '2025-04-14T22:16:06.095Z',
        action: 'page_hit',
        version: '1',
        payload: {
            'user-agent': 'Mozilla/5.0 Test Browser',
            locale: 'en-US',
            location: 'US',
            pathname: '/',
            href: 'https://example.com/',
            site_uuid: UUID,
            post_uuid: 'undefined',
            post_type: 'null',
            member_uuid: 'undefined',
            member_status: 'free'
        }
    };
}

function accepts(schema: z.ZodType, value: unknown): boolean {
    try {
        createValidator(schema)(value);
        return true;
    } catch {
        return false;
    }
}

describe('schema validation', () => {
    // Schemas are written in Zod but enforced by ajv, against a JSON Schema projection of
    // them. Nothing in the type system keeps the two in step, and `toJSONSchema` drops what
    // it cannot express without complaining - so check that they actually agree.
    describe('the ajv projection agrees with Zod', () => {
        // Built lazily so each case is constructed inside its own `it`.
        const cases: Array<[string, z.ZodType, () => unknown]> = [
            ['a valid automation event', AutomationEventSchema, () => validAutomationEvent()],
            ['a valid automation event batch', AutomationRequestBodySchema, () => [validAutomationEvent()]],
            ['an empty automation event batch', AutomationRequestBodySchema, () => []],
            ['an automation event with a field not included in the schema', AutomationEventSchema, () => ({
                ...validAutomationEvent(),
                payload: {...validAutomationEvent().payload, email: 'private@example.com'}
            })],
            ['an automation event with the wrong payload for its discriminator', AutomationEventSchema, () => ({
                ...validAutomationEvent(),
                type: 'automation_run_steps'
            })],
            ['an automation event with an invalid BSON ObjectId', AutomationEventSchema, () => ({
                ...validAutomationEvent(),
                id: 'not-an-object-id'
            })],
            ['a valid raw event', PageHitRawSchema, () => validRawEvent()],
            ['a raw event with a bad site_uuid', PageHitRawSchema, () => ({...validRawEvent(), site_uuid: 'nope'})],
            ['a raw event with a non-canonical timestamp', PageHitRawSchema, () => ({...validRawEvent(), timestamp: '2025-04-14T22:16:06Z'})],
            ['a raw event missing meta', PageHitRawSchema, () => ({...validRawEvent(), meta: undefined})],
            ['a valid request body', PageHitRequestBodySchema, () => validRequestBody()],
            ['a request body with an unknown payload key', PageHitRequestBodySchema, () => ({
                ...validRequestBody(),
                payload: {...validRequestBody().payload, os: 'macOS'}
            })],
            ['a request body with a whitespace-only locale', PageHitRequestBodySchema, () => ({
                ...validRequestBody(),
                payload: {...validRequestBody().payload, locale: '   '}
            })],
            ['a request body with the wrong action', PageHitRequestBodySchema, () => ({...validRequestBody(), action: 'nope'})],
            ['valid query params', PageHitRequestQueryParamsSchema, () => ({name: 'analytics_events', token: 'abc'})],
            ['query params with an unknown key', PageHitRequestQueryParamsSchema, () => ({name: 'analytics_events', extra: 'x'})],
            ['query params with a bad name', PageHitRequestQueryParamsSchema, () => ({name: 'nope'})],
            ['valid headers', PageHitRequestHeadersSchema, () => ({
                'x-site-uuid': UUID,
                'content-type': 'application/json',
                'user-agent': 'Mozilla/5.0 Test Browser'
            })],
            ['headers missing a user-agent', PageHitRequestHeadersSchema, () => ({
                'x-site-uuid': UUID,
                'content-type': 'application/json'
            })]
        ];

        for (const [label, schema, build] of cases) {
            it(`should reach the same verdict for ${label}`, () => {
                // ajv checks in place, so give each side its own copy.
                expect(accepts(schema, build())).toBe(schema.safeParse(build()).success);
            });
        }
    });

    describe('validatorCompiler', () => {
        it('should return ajv errors rather than throwing, so Fastify can format them', () => {
            const validate = validatorCompiler({
                schema: PageHitRequestQueryParamsSchema,
                method: 'POST',
                url: '/api/v1/page_hit',
                httpPart: 'querystring'
            });

            expect(validate({name: 'analytics_events'})).toBe(true);
            expect(validate({name: 'nope'})).toBe(false);
            // Fastify reads `.errors` off the compiled function to build its 400 response.
            expect(validate.errors).toEqual([expect.objectContaining({instancePath: '/name'})]);
        });
    });

    describe('createValidator', () => {
        it('should return the value when it is valid', () => {
            const event = validRawEvent();

            expect(createValidator(PageHitRawSchema)(event)).toBe(event);
        });

        it('should throw a message naming the offending field', () => {
            const validate = createValidator(PageHitRawSchema);

            expect(() => validate({...validRawEvent(), site_uuid: 'nope'})).toThrow(/site_uuid/);
        });

        it('should not coerce values the way the request validator does', () => {
            // Pub/Sub messages arrive as typed JSON. Coercion here would rewrite a null
            // utm_source into an empty string to satisfy the string branch of its union.
            const event = validRawEvent();
            event.payload = {...event.payload, utm_source: null};

            expect(createValidator(PageHitRawSchema)(event).payload.utm_source).toBeNull();
        });

        it('should drop a transform silently, which is why schemas must not use them', () => {
            // Guards the assumption `validation.ts` documents: JSON Schema cannot express a
            // transform, so one added to a schema would stop running with no error anywhere.
            const schema = z.object({n: z.string().transform(value => value.toUpperCase())});

            expect(schema.parse({n: 'a'})).toEqual({n: 'A'});
            expect(createValidator(schema)({n: 'a'})).toEqual({n: 'a'});
        });
    });
});
