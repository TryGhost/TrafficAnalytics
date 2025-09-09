import {describe, it, expect} from 'vitest';
import {Value} from '@sinclair/typebox/value';
import {
    PageHitRequestQueryParamsSchema,
    PageHitRequestHeadersSchema,
    PageHitRequestPayloadSchema,
    PageHitRequestBodySchema,
    PageHitRequestSchema,
    EventIdSchema
} from '../../../../src/schemas';
import assert from 'node:assert/strict';

describe('PageHitRequestSchema v1', () => {
    describe('EventIdSchema', () => {
        it('should validate with an undefined event ID', () => {
            assert.ok(Value.Check(EventIdSchema, undefined), 'Event ID can be undefined');
        });

        it('should validate with a null event ID', () => {
            assert.ok(Value.Check(EventIdSchema, null), 'Event ID can be null');
        });

        it('should validate with a string event ID', () => {
            assert.ok(Value.Check(EventIdSchema, '12345678-1234-1234-1234-123456789012'), 'Event ID can be a string');
        });

        it('should validate with a number event ID', () => {
            assert.ok(Value.Check(EventIdSchema, 123), 'Event ID can be a number');
        });

        it('should validate with a boolean event ID', () => {
            assert.ok(Value.Check(EventIdSchema, true), 'Event ID can be a boolean');
        });

        it('should transform undefined to a UUID', () => {
            const result = Value.Decode(EventIdSchema, undefined);
            expect(typeof result).toBe('string');
            expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        });

        it('should transform null to a UUID', () => {
            const result = Value.Decode(EventIdSchema, null);
            expect(typeof result).toBe('string');
            expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        });

        it('should transform a string event ID to itself', () => {
            const result = Value.Decode(EventIdSchema, '12345678-1234-1234-1234-123456789012');
            expect(result).toBe('12345678-1234-1234-1234-123456789012');
        });

        it('should transform an empty string to a UUID', () => {
            const result = Value.Decode(EventIdSchema, '');
            expect(typeof result).toBe('string');
            expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        });

        it('should transform a non-string value to a UUID', () => {
            const result = Value.Decode(EventIdSchema, 123); 
            expect(typeof result).toBe('string');
            expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        });
    });

    describe('QueryParamsSchema', () => {
        it('should validate valid query parameters', () => {
            const validParams = {
                token: 'test-token',
                name: 'analytics_events'
            };
        
            expect(Value.Check(PageHitRequestQueryParamsSchema, validParams)).toBe(true);
        });

        it('should validate analytics_events_test name', () => {
            const validParams = {
                token: 'test-token',
                name: 'analytics_events_test'
            };
        
            expect(Value.Check(PageHitRequestQueryParamsSchema, validParams)).toBe(true);
        });

        it('should reject invalid name values', () => {
            const invalidParams = {
                token: 'test-token',
                name: 'invalid_event_name'
            };
        
            expect(Value.Check(PageHitRequestQueryParamsSchema, invalidParams)).toBe(false);
        });

        it('should validate without token (optional)', () => {
            const validParams = {
                name: 'analytics_events'
            };
        
            expect(Value.Check(PageHitRequestQueryParamsSchema, validParams)).toBe(true);
        });

        it('should reject empty token when provided', () => {
            const invalidParams = {
                token: '',
                name: 'analytics_events'
            };
        
            expect(Value.Check(PageHitRequestQueryParamsSchema, invalidParams)).toBe(false);
        });

        it('should allow additional properties', () => {
            const validParams = {
                name: 'analytics_events',
                additional: 'property'
            };
        
            expect(Value.Check(PageHitRequestQueryParamsSchema, validParams)).toBe(true);
        });
    });

    describe('HeadersSchema', () => {
        it('should validate valid headers', () => {
            const validHeaders = {
                'x-site-uuid': '12345678-1234-1234-1234-123456789012',
                'content-type': 'application/json',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            };
        
            expect(Value.Check(PageHitRequestHeadersSchema, validHeaders)).toBe(true);
        });

        it('should validate with optional referer', () => {
            const validHeaders = {
                'x-site-uuid': '12345678-1234-1234-1234-123456789012',
                'content-type': 'application/json',
                'user-agent': 'Mozilla/5.0',
                referer: 'https://example.com'
            };
        
            expect(Value.Check(PageHitRequestHeadersSchema, validHeaders)).toBe(true);
        });

        it('should reject invalid UUID format', () => {
            const invalidHeaders = {
                'x-site-uuid': 'invalid-uuid',
                'content-type': 'application/json',
                'user-agent': 'Mozilla/5.0'
            };
        
            expect(Value.Check(PageHitRequestHeadersSchema, invalidHeaders)).toBe(false);
        });

        it('should reject invalid content-type', () => {
            const invalidHeaders = {
                'x-site-uuid': '12345678-1234-1234-1234-123456789012',
                'content-type': 'text/plain',
                'user-agent': 'Mozilla/5.0'
            };
        
            expect(Value.Check(PageHitRequestHeadersSchema, invalidHeaders)).toBe(false);
        });

        it('should reject missing required headers', () => {
            const invalidHeaders = {
                'x-site-uuid': '12345678-1234-1234-1234-123456789012'
            // Missing content-type and user-agent
            };
        
            expect(Value.Check(PageHitRequestHeadersSchema, invalidHeaders)).toBe(false);
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
            expect(Value.Check(PageHitRequestPayloadSchema, validPayload)).toBe(true);
        });

        it('should validate with null referrer', () => {
            const payloadWithNullReferrer = {
                ...validPayload,
                referrer: null
            };
        
            expect(Value.Check(PageHitRequestPayloadSchema, payloadWithNullReferrer)).toBe(true);
        });

        it('should validate without referrer field (optional)', () => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const {referrer, ...payloadWithoutReferrer} = validPayload;
        
            expect(Value.Check(PageHitRequestPayloadSchema, payloadWithoutReferrer)).toBe(true);
        });

        it('should validate with empty string referrer', () => {
            const payloadWithEmptyReferrer = {
                ...validPayload,
                referrer: ''
            };
        
            expect(Value.Check(PageHitRequestPayloadSchema, payloadWithEmptyReferrer)).toBe(true);
        });

        it('should validate with UUID post_uuid', () => {
            const payloadWithUUIDPost = {
                ...validPayload,
                post_uuid: '12345678-1234-1234-1234-123456789012'
            };
        
            expect(Value.Check(PageHitRequestPayloadSchema, payloadWithUUIDPost)).toBe(true);
        });

        it('should validate with UUID member_uuid', () => {
            const payloadWithUUIDMember = {
                ...validPayload,
                member_uuid: '12345678-1234-1234-1234-123456789012'
            };
        
            expect(Value.Check(PageHitRequestPayloadSchema, payloadWithUUIDMember)).toBe(true);
        });

        it('should validate all post_type values', () => {
            const postTypes = ['null', 'post', 'page'];
        
            postTypes.forEach((postType) => {
                const payload = {
                    ...validPayload,
                    post_type: postType
                };
                expect(Value.Check(PageHitRequestPayloadSchema, payload)).toBe(true);
            });
        });

        it('should reject invalid post_type', () => {
            const invalidPayload = {
                ...validPayload,
                post_type: 'article'
            };
        
            expect(Value.Check(PageHitRequestPayloadSchema, invalidPayload)).toBe(false);
        });

        it('should not be too strict about the href value', () => {
            const invalidPayload = {
                ...validPayload,
                href: 'not-a-url'
            };
        
            expect(Value.Check(PageHitRequestPayloadSchema, invalidPayload)).toBe(true);
        });

        it('should reject empty required strings', () => {
            const invalidPayload = {
                ...validPayload,
                'user-agent': ''
            };
        
            expect(Value.Check(PageHitRequestPayloadSchema, invalidPayload)).toBe(false);
        });

        it('should reject invalid site_uuid', () => {
            const invalidPayload = {
                ...validPayload,
                site_uuid: 'invalid-uuid'
            };
        
            expect(Value.Check(PageHitRequestPayloadSchema, invalidPayload)).toBe(false);
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
            
            expect(Value.Check(PageHitRequestPayloadSchema, healthcheckPayload)).toBe(true);
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
        
            expect(Value.Check(PageHitRequestPayloadSchema, payloadWithParsedReferrer)).toBe(true);
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
        
            expect(Value.Check(PageHitRequestPayloadSchema, payloadWithMixedParsedReferrer)).toBe(true);
        });

        it('should validate without parsedReferrer field (optional)', () => {
            const payloadWithoutParsedReferrer = {
                ...validPayload
                // parsedReferrer field omitted
            };
        
            expect(Value.Check(PageHitRequestPayloadSchema, payloadWithoutParsedReferrer)).toBe(true);
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
        
            expect(Value.Check(PageHitRequestPayloadSchema, payloadWithIncompleteParsedReferrer)).toBe(false);
        });

        it('should validate parsedReferrer with UTM parameters', () => {
            const payloadWithUTMParams = {
                ...validPayload,
                parsedReferrer: {
                    source: 'newsletter',
                    medium: 'email',
                    url: 'https://example.com',
                    utmSource: 'newsletter',
                    utmMedium: 'email',
                    utmCampaign: 'summer-sale',
                    utmTerm: 'ghost-cms',
                    utmContent: 'header-link'
                }
            };

            expect(Value.Check(PageHitRequestPayloadSchema, payloadWithUTMParams)).toBe(true);
        });

        it('should validate parsedReferrer with partial UTM parameters', () => {
            const payloadWithPartialUTM = {
                ...validPayload,
                parsedReferrer: {
                    source: 'google',
                    medium: 'cpc',
                    url: 'https://example.com',
                    utmSource: 'google',
                    utmMedium: 'cpc',
                    utmCampaign: 'brand-awareness'
                    // utmTerm and utmContent are omitted
                }
            };

            expect(Value.Check(PageHitRequestPayloadSchema, payloadWithPartialUTM)).toBe(true);
        });

        it('should validate parsedReferrer with null UTM parameters', () => {
            const payloadWithNullUTM = {
                ...validPayload,
                parsedReferrer: {
                    source: 'direct',
                    medium: null,
                    url: 'https://example.com',
                    utmSource: null,
                    utmMedium: null,
                    utmCampaign: null,
                    utmTerm: null,
                    utmContent: null
                }
            };

            expect(Value.Check(PageHitRequestPayloadSchema, payloadWithNullUTM)).toBe(true);
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

            expect(Value.Check(PageHitRequestPayloadSchema, payloadWithoutUTM)).toBe(true);
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
        
            expect(Value.Check(PageHitRequestPayloadSchema, payloadWithInvalidParsedReferrer)).toBe(false);
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
            expect(Value.Check(PageHitRequestBodySchema, validBody)).toBe(true);
        });

        it('should validate body without session_id (optional)', () => {
            const bodyWithoutSessionId = {
                timestamp: validBody.timestamp,
                action: validBody.action,
                version: validBody.version,
                payload: validBody.payload
                // session_id omitted
            };
            
            expect(Value.Check(PageHitRequestBodySchema, bodyWithoutSessionId)).toBe(true);
        });

        it('should reject invalid timestamp format', () => {
            const invalidBody = {
                ...validBody,
                timestamp: '2024-01-01'
            };
        
            expect(Value.Check(PageHitRequestBodySchema, invalidBody)).toBe(false);
        });

        it('should reject invalid action', () => {
            const invalidBody = {
                ...validBody,
                action: 'click_event'
            };
        
            expect(Value.Check(PageHitRequestBodySchema, invalidBody)).toBe(false);
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
            expect(Value.Check(PageHitRequestSchema, validRequest)).toBe(true);
        });

        it('should reject request with invalid query params', () => {
            const invalidRequest = {
                ...validRequest,
                querystring: {
                    name: 'invalid_name'
                }
            };
        
            expect(Value.Check(PageHitRequestSchema, invalidRequest)).toBe(false);
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
        
            expect(Value.Check(PageHitRequestSchema, invalidRequest)).toBe(false);
        });

        it('should reject request with invalid body', () => {
            const invalidRequest = {
                ...validRequest,
                body: {
                    ...validRequest.body,
                    action: 'invalid_action'
                }
            };
        
            expect(Value.Check(PageHitRequestSchema, invalidRequest)).toBe(false);
        });
    });
});