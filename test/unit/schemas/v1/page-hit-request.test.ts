import {describe, it, expect} from 'vitest';
import {
    PageHitRequestQueryParamsSchema,
    PageHitRequestHeadersSchema,
    PageHitRequestPayloadSchema,
    PageHitRequestBodySchema,
    PageHitRequestSchema,
    EventIdSchema,
    resolveEventId
} from '../../../../src/schemas';
import assert from 'node:assert/strict';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('PageHitRequestSchema v1', () => {
    describe('EventIdSchema', () => {
        // The schema deliberately accepts anything, so that a junk event ID is replaced by
        // resolveEventId rather than turning the whole request into a 400.
        const anyValues = [
            ['undefined', undefined],
            ['null', null],
            ['a string', '12345678-1234-1234-1234-123456789012'],
            ['a number', 123],
            ['a boolean', true]
        ] as const;

        for (const [label, value] of anyValues) {
            it(`should validate with ${label} as the event ID`, () => {
                assert.ok(EventIdSchema.safeParse(value).success, `Event ID can be ${label}`);
            });
        }
    });

    describe('resolveEventId', () => {
        it('should keep a non-empty string as-is, even when it is not a valid UUID', () => {
            expect(resolveEventId('12345678-1234-1234-1234-123456789012')).toBe('12345678-1234-1234-1234-123456789012');
            expect(resolveEventId('not-a-uuid')).toBe('not-a-uuid');
        });

        const generatedCases = [
            ['undefined', undefined],
            ['null', null],
            ['an empty string', ''],
            ['a number', 123],
            ['a boolean', true],
            ['an object', {}]
        ] as const;

        for (const [label, value] of generatedCases) {
            it(`should generate a UUID for ${label}`, () => {
                expect(resolveEventId(value)).toMatch(UUID_PATTERN);
            });
        }

        it('should generate a different UUID on each call', () => {
            expect(resolveEventId(undefined)).not.toBe(resolveEventId(undefined));
        });
    });

    describe('QueryParamsSchema', () => {
        it('should validate valid query parameters', () => {
            const validParams = {
                token: 'test-token',
                name: 'analytics_events'
            };
        
            expect(PageHitRequestQueryParamsSchema.safeParse(validParams).success).toBe(true);
        });

        it('should validate analytics_events_test name', () => {
            const validParams = {
                token: 'test-token',
                name: 'analytics_events_test'
            };
        
            expect(PageHitRequestQueryParamsSchema.safeParse(validParams).success).toBe(true);
        });

        it('should reject invalid name values', () => {
            const invalidParams = {
                token: 'test-token',
                name: 'invalid_event_name'
            };
        
            expect(PageHitRequestQueryParamsSchema.safeParse(invalidParams).success).toBe(false);
        });

        it('should validate without token (optional)', () => {
            const validParams = {
                name: 'analytics_events'
            };
        
            expect(PageHitRequestQueryParamsSchema.safeParse(validParams).success).toBe(true);
        });

        it('should reject empty token when provided', () => {
            const invalidParams = {
                token: '',
                name: 'analytics_events'
            };
        
            expect(PageHitRequestQueryParamsSchema.safeParse(invalidParams).success).toBe(false);
        });

        it('should allow additional properties', () => {
            const validParams = {
                name: 'analytics_events',
                additional: 'property'
            };
        
            expect(PageHitRequestQueryParamsSchema.safeParse(validParams).success).toBe(true);
        });
    });

    describe('HeadersSchema', () => {
        it('should validate valid headers', () => {
            const validHeaders = {
                'x-site-uuid': '12345678-1234-1234-1234-123456789012',
                'content-type': 'application/json',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            };
        
            expect(PageHitRequestHeadersSchema.safeParse(validHeaders).success).toBe(true);
        });

        it('should validate with optional referer', () => {
            const validHeaders = {
                'x-site-uuid': '12345678-1234-1234-1234-123456789012',
                'content-type': 'application/json',
                'user-agent': 'Mozilla/5.0',
                referer: 'https://example.com'
            };
        
            expect(PageHitRequestHeadersSchema.safeParse(validHeaders).success).toBe(true);
        });

        it('should reject invalid UUID format', () => {
            const invalidHeaders = {
                'x-site-uuid': 'invalid-uuid',
                'content-type': 'application/json',
                'user-agent': 'Mozilla/5.0'
            };
        
            expect(PageHitRequestHeadersSchema.safeParse(invalidHeaders).success).toBe(false);
        });

        it('should reject invalid content-type', () => {
            const invalidHeaders = {
                'x-site-uuid': '12345678-1234-1234-1234-123456789012',
                'content-type': 'text/plain',
                'user-agent': 'Mozilla/5.0'
            };
        
            expect(PageHitRequestHeadersSchema.safeParse(invalidHeaders).success).toBe(false);
        });

        it('should reject missing required headers', () => {
            const invalidHeaders = {
                'x-site-uuid': '12345678-1234-1234-1234-123456789012'
            // Missing content-type and user-agent
            };
        
            expect(PageHitRequestHeadersSchema.safeParse(invalidHeaders).success).toBe(false);
        });
    });

    describe('PayloadSchema', () => {
        const validPayload = {
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            locale: 'en-US',
            location: 'homepage',
            referrer: 'https://google.com',
            pathname: '/blog/post',
            href: 'https://example.com/blog/post',
            site_uuid: '12345678-1234-1234-1234-123456789012',
            post_uuid: 'undefined',
            post_type: 'post',
            member_uuid: 'undefined',
            member_status: 'free'
        };

        it('should validate valid payload', () => {
            expect(PageHitRequestPayloadSchema.safeParse(validPayload).success).toBe(true);
        });

        it('should validate with null referrer', () => {
            const payloadWithNullReferrer = {
                ...validPayload,
                referrer: null
            };
        
            expect(PageHitRequestPayloadSchema.safeParse(payloadWithNullReferrer).success).toBe(true);
        });

        it('should validate without referrer field (optional)', () => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const {referrer, ...payloadWithoutReferrer} = validPayload;
        
            expect(PageHitRequestPayloadSchema.safeParse(payloadWithoutReferrer).success).toBe(true);
        });

        it('should validate with empty string referrer', () => {
            const payloadWithEmptyReferrer = {
                ...validPayload,
                referrer: ''
            };
        
            expect(PageHitRequestPayloadSchema.safeParse(payloadWithEmptyReferrer).success).toBe(true);
        });

        it('should validate with UUID post_uuid', () => {
            const payloadWithUUIDPost = {
                ...validPayload,
                post_uuid: '12345678-1234-1234-1234-123456789012'
            };
        
            expect(PageHitRequestPayloadSchema.safeParse(payloadWithUUIDPost).success).toBe(true);
        });

        it('should validate with UUID member_uuid', () => {
            const payloadWithUUIDMember = {
                ...validPayload,
                member_uuid: '12345678-1234-1234-1234-123456789012'
            };
        
            expect(PageHitRequestPayloadSchema.safeParse(payloadWithUUIDMember).success).toBe(true);
        });

        it('should validate all post_type values', () => {
            const postTypes = ['null', 'post', 'page'];
        
            postTypes.forEach((postType) => {
                const payload = {
                    ...validPayload,
                    post_type: postType
                };
                expect(PageHitRequestPayloadSchema.safeParse(payload).success).toBe(true);
            });
        });

        it('should reject invalid post_type', () => {
            const invalidPayload = {
                ...validPayload,
                post_type: 'article'
            };
        
            expect(PageHitRequestPayloadSchema.safeParse(invalidPayload).success).toBe(false);
        });

        it('should not be too strict about the href value', () => {
            const invalidPayload = {
                ...validPayload,
                href: 'not-a-url'
            };
        
            expect(PageHitRequestPayloadSchema.safeParse(invalidPayload).success).toBe(true);
        });

        it('should reject empty required strings', () => {
            const invalidPayload = {
                ...validPayload,
                'user-agent': ''
            };
        
            expect(PageHitRequestPayloadSchema.safeParse(invalidPayload).success).toBe(false);
        });

        it('should reject invalid site_uuid', () => {
            const invalidPayload = {
                ...validPayload,
                site_uuid: 'invalid-uuid'
            };
        
            expect(PageHitRequestPayloadSchema.safeParse(invalidPayload).success).toBe(false);
        });

        it('should validate real healthcheck payload with null location and undefined member_status', () => {
            const healthcheckPayload = {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.7204.23 Safari/537.36',
                locale: 'en-US',
                location: null,
                referrer: null,
                parsedReferrer: {
                    source: null,
                    medium: null,
                    url: null
                },
                pathname: '/',
                href: 'https://traffic-analytics.ghst.pro/',
                site_uuid: 'c7929de8-27d7-404e-b714-0fc774f701e6',
                post_uuid: 'undefined',
                post_type: 'null',
                member_uuid: 'undefined',
                member_status: 'undefined'
            };
            
            expect(PageHitRequestPayloadSchema.safeParse(healthcheckPayload).success).toBe(true);
        });

        it('should validate with parsedReferrer object with all string values', () => {
            const payloadWithParsedReferrer = {
                ...validPayload,
                parsedReferrer: {
                    source: 'google',
                    medium: 'organic',
                    url: 'https://google.com'
                }
            };
        
            expect(PageHitRequestPayloadSchema.safeParse(payloadWithParsedReferrer).success).toBe(true);
        });

        it('should validate with parsedReferrer object with mixed null and string values', () => {
            const payloadWithMixedParsedReferrer = {
                ...validPayload,
                parsedReferrer: {
                    source: 'facebook',
                    medium: null,
                    url: 'https://facebook.com'
                }
            };
        
            expect(PageHitRequestPayloadSchema.safeParse(payloadWithMixedParsedReferrer).success).toBe(true);
        });

        it('should validate without parsedReferrer field (optional)', () => {
            const payloadWithoutParsedReferrer = {
                ...validPayload
                // parsedReferrer field omitted
            };
        
            expect(PageHitRequestPayloadSchema.safeParse(payloadWithoutParsedReferrer).success).toBe(true);
        });

        it('should reject parsedReferrer with missing required fields', () => {
            const payloadWithIncompleteParsedReferrer = {
                ...validPayload,
                parsedReferrer: {
                    source: 'google',
                    medium: 'organic'
                    // missing url field
                }
            };
        
            expect(PageHitRequestPayloadSchema.safeParse(payloadWithIncompleteParsedReferrer).success).toBe(false);
        });

        it('should validate parsedReferrer with UTM parameters', () => {
            const payloadWithUTMParams = {
                ...validPayload,
                parsedReferrer: {
                    source: 'newsletter',
                    medium: 'email',
                    url: 'https://example.com',
                    utm_source: 'newsletter',
                    utm_medium: 'email',
                    utm_campaign: 'summer-sale',
                    utm_term: 'ghost-cms',
                    utm_content: 'header-link'
                }
            };

            expect(PageHitRequestPayloadSchema.safeParse(payloadWithUTMParams).success).toBe(true);
        });

        it('should validate parsedReferrer with partial UTM parameters', () => {
            const payloadWithPartialUTM = {
                ...validPayload,
                parsedReferrer: {
                    source: 'google',
                    medium: 'cpc',
                    url: 'https://example.com',
                    utm_source: 'google',
                    utm_medium: 'cpc',
                    utm_campaign: 'brand-awareness'
                    // utmTerm and utmContent are omitted
                }
            };

            expect(PageHitRequestPayloadSchema.safeParse(payloadWithPartialUTM).success).toBe(true);
        });

        it('should validate parsedReferrer with null UTM parameters', () => {
            const payloadWithNullUTM = {
                ...validPayload,
                parsedReferrer: {
                    source: 'direct',
                    medium: null,
                    url: 'https://example.com',
                    utm_source: null,
                    utm_medium: null,
                    utm_campaign: null,
                    utm_term: null,
                    utm_content: null
                }
            };

            expect(PageHitRequestPayloadSchema.safeParse(payloadWithNullUTM).success).toBe(true);
        });

        it('should validate parsedReferrer without UTM parameters', () => {
            const payloadWithoutUTM = {
                ...validPayload,
                parsedReferrer: {
                    source: 'organic',
                    medium: 'search',
                    url: 'https://google.com'
                    // no UTM fields
                }
            };

            expect(PageHitRequestPayloadSchema.safeParse(payloadWithoutUTM).success).toBe(true);
        });

        it('should reject parsedReferrer with invalid field types', () => {
            const payloadWithInvalidParsedReferrer = {
                ...validPayload,
                parsedReferrer: {
                    source: 123, // should be string or null
                    medium: 'organic',
                    url: 'https://google.com'
                }
            };
        
            expect(PageHitRequestPayloadSchema.safeParse(payloadWithInvalidParsedReferrer).success).toBe(false);
        });
    });

    describe('BodySchema', () => {
        const validBody = {
            timestamp: '2024-01-01T00:00:00.000Z',
            action: 'page_hit',
            version: '1',
            session_id: 'test-session-id',
            payload: {
                'user-agent': 'Mozilla/5.0',
                locale: 'en-US',
                location: 'homepage',
                pathname: '/blog',
                href: 'https://example.com/blog',
                site_uuid: '12345678-1234-1234-1234-123456789012',
                post_uuid: 'undefined',
                post_type: 'post',
                member_uuid: 'undefined',
                member_status: 'free'
            }
        };

        it('should validate valid body', () => {
            expect(PageHitRequestBodySchema.safeParse(validBody).success).toBe(true);
        });

        it('should validate body without session_id (optional)', () => {
            const bodyWithoutSessionId = {
                timestamp: validBody.timestamp,
                action: validBody.action,
                version: validBody.version,
                payload: validBody.payload
                // session_id omitted
            };
            
            expect(PageHitRequestBodySchema.safeParse(bodyWithoutSessionId).success).toBe(true);
        });

        it('should reject invalid timestamp format', () => {
            const invalidBody = {
                ...validBody,
                timestamp: '2024-01-01'
            };
        
            expect(PageHitRequestBodySchema.safeParse(invalidBody).success).toBe(false);
        });

        it('should reject invalid action', () => {
            const invalidBody = {
                ...validBody,
                action: 'click_event'
            };
        
            expect(PageHitRequestBodySchema.safeParse(invalidBody).success).toBe(false);
        });
    });

    describe('PageHitRequestSchema', () => {
        const validRequest = {
            querystring: {
                name: 'analytics_events'
            },
            headers: {
                'x-site-uuid': '12345678-1234-1234-1234-123456789012',
                'content-type': 'application/json',
                'user-agent': 'Mozilla/5.0'
            },
            body: {
                timestamp: '2024-01-01T00:00:00.000Z',
                action: 'page_hit',
                version: '1',
                session_id: 'test-session-id',
                payload: {
                    'user-agent': 'Mozilla/5.0',
                    locale: 'en-US',
                    location: 'homepage',
                    pathname: '/blog',
                    href: 'https://example.com/blog',
                    site_uuid: '12345678-1234-1234-1234-123456789012',
                    post_uuid: 'undefined',
                    post_type: 'post',
                    member_uuid: 'undefined',
                    member_status: 'free'
                }
            }
        };

        it('should validate complete valid request', () => {
            expect(PageHitRequestSchema.safeParse(validRequest).success).toBe(true);
        });

        it('should reject request with invalid query params', () => {
            const invalidRequest = {
                ...validRequest,
                querystring: {
                    name: 'invalid_name'
                }
            };
        
            expect(PageHitRequestSchema.safeParse(invalidRequest).success).toBe(false);
        });

        it('should reject request with invalid headers', () => {
            const invalidRequest = {
                ...validRequest,
                headers: {
                    'x-site-uuid': 'invalid-uuid',
                    'content-type': 'application/json',
                    'user-agent': 'Mozilla/5.0'
                }
            };
        
            expect(PageHitRequestSchema.safeParse(invalidRequest).success).toBe(false);
        });

        it('should reject request with invalid body', () => {
            const invalidRequest = {
                ...validRequest,
                body: {
                    ...validRequest.body,
                    action: 'invalid_action'
                }
            };
        
            expect(PageHitRequestSchema.safeParse(invalidRequest).success).toBe(false);
        });
    });
});