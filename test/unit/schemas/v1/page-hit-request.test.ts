import {describe, it, expect} from 'vitest';
import {Value} from '@sinclair/typebox/value';
import {
    QueryParamsSchema,
    HeadersSchema,
    PayloadSchema,
    BodySchema,
    PageHitRequestSchema
} from '../../../../src/schemas';

describe('PageHitRequestSchema v1', () => {
    describe('QueryParamsSchema', () => {
        it('should validate valid query parameters', () => {
            const validParams = {
                token: 'test-token',
                name: 'analytics_events'
            };
        
            expect(Value.Check(QueryParamsSchema, validParams)).toBe(true);
        });

        it('should validate analytics_events_test name', () => {
            const validParams = {
                token: 'test-token',
                name: 'analytics_events_test'
            };
        
            expect(Value.Check(QueryParamsSchema, validParams)).toBe(true);
        });

        it('should reject invalid name values', () => {
            const invalidParams = {
                token: 'test-token',
                name: 'invalid_event_name'
            };
        
            expect(Value.Check(QueryParamsSchema, invalidParams)).toBe(false);
        });

        it('should validate without token (optional)', () => {
            const validParams = {
                name: 'analytics_events'
            };
        
            expect(Value.Check(QueryParamsSchema, validParams)).toBe(true);
        });

        it('should reject empty token when provided', () => {
            const invalidParams = {
                token: '',
                name: 'analytics_events'
            };
        
            expect(Value.Check(QueryParamsSchema, invalidParams)).toBe(false);
        });

        it('should allow additional properties', () => {
            const validParams = {
                name: 'analytics_events',
                additional: 'property'
            };
        
            expect(Value.Check(QueryParamsSchema, validParams)).toBe(true);
        });
    });

    describe('HeadersSchema', () => {
        it('should validate valid headers', () => {
            const validHeaders = {
                'x-site-uuid': '12345678-1234-1234-1234-123456789012',
                'content-type': 'application/json',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            };
        
            expect(Value.Check(HeadersSchema, validHeaders)).toBe(true);
        });

        it('should validate with optional referer', () => {
            const validHeaders = {
                'x-site-uuid': '12345678-1234-1234-1234-123456789012',
                'content-type': 'application/json',
                'user-agent': 'Mozilla/5.0',
                referer: 'https://example.com'
            };
        
            expect(Value.Check(HeadersSchema, validHeaders)).toBe(true);
        });

        it('should reject invalid UUID format', () => {
            const invalidHeaders = {
                'x-site-uuid': 'invalid-uuid',
                'content-type': 'application/json',
                'user-agent': 'Mozilla/5.0'
            };
        
            expect(Value.Check(HeadersSchema, invalidHeaders)).toBe(false);
        });

        it('should reject invalid content-type', () => {
            const invalidHeaders = {
                'x-site-uuid': '12345678-1234-1234-1234-123456789012',
                'content-type': 'text/plain',
                'user-agent': 'Mozilla/5.0'
            };
        
            expect(Value.Check(HeadersSchema, invalidHeaders)).toBe(false);
        });

        it('should reject missing required headers', () => {
            const invalidHeaders = {
                'x-site-uuid': '12345678-1234-1234-1234-123456789012'
            // Missing content-type and user-agent
            };
        
            expect(Value.Check(HeadersSchema, invalidHeaders)).toBe(false);
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
            expect(Value.Check(PayloadSchema, validPayload)).toBe(true);
        });

        it('should validate with null referrer', () => {
            const payloadWithNullReferrer = {
                ...validPayload,
                referrer: null
            };
        
            expect(Value.Check(PayloadSchema, payloadWithNullReferrer)).toBe(true);
        });

        it('should validate without referrer field (optional)', () => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const {referrer, ...payloadWithoutReferrer} = validPayload;
        
            expect(Value.Check(PayloadSchema, payloadWithoutReferrer)).toBe(true);
        });

        it('should validate with empty string referrer', () => {
            const payloadWithEmptyReferrer = {
                ...validPayload,
                referrer: ''
            };
        
            expect(Value.Check(PayloadSchema, payloadWithEmptyReferrer)).toBe(true);
        });

        it('should validate with UUID post_uuid', () => {
            const payloadWithUUIDPost = {
                ...validPayload,
                post_uuid: '12345678-1234-1234-1234-123456789012'
            };
        
            expect(Value.Check(PayloadSchema, payloadWithUUIDPost)).toBe(true);
        });

        it('should validate with UUID member_uuid', () => {
            const payloadWithUUIDMember = {
                ...validPayload,
                member_uuid: '12345678-1234-1234-1234-123456789012'
            };
        
            expect(Value.Check(PayloadSchema, payloadWithUUIDMember)).toBe(true);
        });

        it('should validate all post_type values', () => {
            const postTypes = ['null', 'post', 'page'];
        
            postTypes.forEach((postType) => {
                const payload = {
                    ...validPayload,
                    post_type: postType
                };
                expect(Value.Check(PayloadSchema, payload)).toBe(true);
            });
        });

        it('should reject invalid post_type', () => {
            const invalidPayload = {
                ...validPayload,
                post_type: 'article'
            };
        
            expect(Value.Check(PayloadSchema, invalidPayload)).toBe(false);
        });

        it('should reject invalid href URL', () => {
            const invalidPayload = {
                ...validPayload,
                href: 'not-a-url'
            };
        
            expect(Value.Check(PayloadSchema, invalidPayload)).toBe(false);
        });

        it('should reject empty required strings', () => {
            const invalidPayload = {
                ...validPayload,
                'user-agent': ''
            };
        
            expect(Value.Check(PayloadSchema, invalidPayload)).toBe(false);
        });

        it('should reject invalid site_uuid', () => {
            const invalidPayload = {
                ...validPayload,
                site_uuid: 'invalid-uuid'
            };
        
            expect(Value.Check(PayloadSchema, invalidPayload)).toBe(false);
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
            
            expect(Value.Check(PayloadSchema, healthcheckPayload)).toBe(true);
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
        
            expect(Value.Check(PayloadSchema, payloadWithParsedReferrer)).toBe(true);
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
        
            expect(Value.Check(PayloadSchema, payloadWithMixedParsedReferrer)).toBe(true);
        });

        it('should validate without parsedReferrer field (optional)', () => {
            const payloadWithoutParsedReferrer = {
                ...validPayload
                // parsedReferrer field omitted
            };
        
            expect(Value.Check(PayloadSchema, payloadWithoutParsedReferrer)).toBe(true);
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
        
            expect(Value.Check(PayloadSchema, payloadWithIncompleteParsedReferrer)).toBe(false);
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
        
            expect(Value.Check(PayloadSchema, payloadWithInvalidParsedReferrer)).toBe(false);
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
            expect(Value.Check(BodySchema, validBody)).toBe(true);
        });

        it('should validate body without session_id (optional)', () => {
            const bodyWithoutSessionId = {
                timestamp: validBody.timestamp,
                action: validBody.action,
                version: validBody.version,
                payload: validBody.payload
                // session_id omitted
            };
            
            expect(Value.Check(BodySchema, bodyWithoutSessionId)).toBe(true);
        });

        it('should reject invalid timestamp format', () => {
            const invalidBody = {
                ...validBody,
                timestamp: '2024-01-01'
            };
        
            expect(Value.Check(BodySchema, invalidBody)).toBe(false);
        });

        it('should reject invalid action', () => {
            const invalidBody = {
                ...validBody,
                action: 'click_event'
            };
        
            expect(Value.Check(BodySchema, invalidBody)).toBe(false);
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