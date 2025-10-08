import {describe, it, expect} from 'vitest';
import {Value} from '@sinclair/typebox/value';
import {PageHitRawSchema} from '../../../../src/schemas';

describe('PageHitRawSchema v1', () => {
    const validPageHitRaw = {
        timestamp: '2024-01-01T00:00:00.000Z',
        action: 'page_hit',
        version: '1',
        site_uuid: '12345678-1234-1234-1234-123456789012',
        payload: {
            event_id: '550e8400-e29b-41d4-a716-446655440000',
            member_uuid: 'undefined',
            member_status: 'free',
            post_uuid: 'undefined',
            post_type: 'post',
            locale: 'en-US',
            location: 'homepage',
            referrer: 'https://google.com',
            pathname: '/blog/post',
            href: 'https://example.com/blog/post',
            meta: {
                received_timestamp: '2025-01-01T00:00:00.000Z'
            }
        },
        meta: {
            ip: '192.168.1.1',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
    };

    it('should validate valid page hit raw data', () => {
        expect(Value.Check(PageHitRawSchema, validPageHitRaw)).toBe(true);
    });

    describe('timestamp validation', () => {
        it('should validate valid ISO8601 timestamp', () => {
            const validData = {
                ...validPageHitRaw,
                timestamp: '2024-12-25T15:30:45.123Z'
            };
            expect(Value.Check(PageHitRawSchema, validData)).toBe(true);
        });

        it('should reject invalid timestamp format', () => {
            const invalidData = {
                ...validPageHitRaw,
                timestamp: '2024-01-01'
            };
            expect(Value.Check(PageHitRawSchema, invalidData)).toBe(false);
        });

        it('should reject non-ISO8601 timestamp', () => {
            const invalidData = {
                ...validPageHitRaw,
                timestamp: 'January 1, 2024'
            };
            expect(Value.Check(PageHitRawSchema, invalidData)).toBe(false);
        });
    });

    describe('action validation', () => {
        it('should validate page_hit action', () => {
            const validData = {
                ...validPageHitRaw,
                action: 'page_hit'
            };
            expect(Value.Check(PageHitRawSchema, validData)).toBe(true);
        });

        it('should reject invalid action', () => {
            const invalidData = {
                ...validPageHitRaw,
                action: 'click_event'
            };
            expect(Value.Check(PageHitRawSchema, invalidData)).toBe(false);
        });
    });

    describe('version validation', () => {
        it('should validate version "1"', () => {
            const validData = {
                ...validPageHitRaw,
                version: '1'
            };
            expect(Value.Check(PageHitRawSchema, validData)).toBe(true);
        });

        it('should reject invalid version', () => {
            const invalidData = {
                ...validPageHitRaw,
                version: '2'
            };
            expect(Value.Check(PageHitRawSchema, invalidData)).toBe(false);
        });
    });

    describe('site_uuid validation', () => {
        it('should validate valid UUID', () => {
            const validData = {
                ...validPageHitRaw,
                site_uuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
            };
            expect(Value.Check(PageHitRawSchema, validData)).toBe(true);
        });

        it('should reject invalid UUID format', () => {
            const invalidData = {
                ...validPageHitRaw,
                site_uuid: 'invalid-uuid'
            };
            expect(Value.Check(PageHitRawSchema, invalidData)).toBe(false);
        });
    });

    describe('payload validation', () => {
        it('should validate with UUID member_uuid', () => {
            const validData = {
                ...validPageHitRaw,
                payload: {
                    ...validPageHitRaw.payload,
                    member_uuid: '12345678-1234-1234-1234-123456789012'
                }
            };
            expect(Value.Check(PageHitRawSchema, validData)).toBe(true);
        });

        it('should validate with "undefined" member_uuid', () => {
            const validData = {
                ...validPageHitRaw,
                payload: {
                    ...validPageHitRaw.payload,
                    member_uuid: 'undefined'
                }
            };
            expect(Value.Check(PageHitRawSchema, validData)).toBe(true);
        });

        it('should validate with "undefined" member_status', () => {
            const validData = {
                ...validPageHitRaw,
                payload: {
                    ...validPageHitRaw.payload,
                    member_status: 'undefined'
                }
            };
            expect(Value.Check(PageHitRawSchema, validData)).toBe(true);
        });

        it('should validate with UUID post_uuid', () => {
            const validData = {
                ...validPageHitRaw,
                payload: {
                    ...validPageHitRaw.payload,
                    post_uuid: '12345678-1234-1234-1234-123456789012'
                }
            };
            expect(Value.Check(PageHitRawSchema, validData)).toBe(true);
        });

        it('should validate with "undefined" post_uuid', () => {
            const validData = {
                ...validPageHitRaw,
                payload: {
                    ...validPageHitRaw.payload,
                    post_uuid: 'undefined'
                }
            };
            expect(Value.Check(PageHitRawSchema, validData)).toBe(true);
        });

        it('should validate all post_type values', () => {
            const postTypes = ['null', 'post', 'page'];

            postTypes.forEach((postType) => {
                const validData = {
                    ...validPageHitRaw,
                    payload: {
                        ...validPageHitRaw.payload,
                        post_type: postType
                    }
                };
                expect(Value.Check(PageHitRawSchema, validData)).toBe(true);
            });
        });

        it('should reject invalid post_type', () => {
            const invalidData = {
                ...validPageHitRaw,
                payload: {
                    ...validPageHitRaw.payload,
                    post_type: 'article'
                }
            };
            expect(Value.Check(PageHitRawSchema, invalidData)).toBe(false);
        });

        it('should validate with null location', () => {
            const validData = {
                ...validPageHitRaw,
                payload: {
                    ...validPageHitRaw.payload,
                    location: null
                }
            };
            expect(Value.Check(PageHitRawSchema, validData)).toBe(true);
        });

        it('should validate with null referrer', () => {
            const validData = {
                ...validPageHitRaw,
                payload: {
                    ...validPageHitRaw.payload,
                    referrer: null
                }
            };
            expect(Value.Check(PageHitRawSchema, validData)).toBe(true);
        });

        it('should validate without referrer field (optional)', () => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const {referrer, ...payloadWithoutReferrer} = validPageHitRaw.payload;
            const validData = {
                ...validPageHitRaw,
                payload: payloadWithoutReferrer
            };
            expect(Value.Check(PageHitRawSchema, validData)).toBe(true);
        });

        it('should validate with parsedReferrer object with all string values', () => {
            const validData = {
                ...validPageHitRaw,
                payload: {
                    ...validPageHitRaw.payload,
                    parsedReferrer: {
                        source: 'google',
                        medium: 'organic',
                        url: 'https://google.com'
                    }
                }
            };
            expect(Value.Check(PageHitRawSchema, validData)).toBe(true);
        });

        it('should validate with parsedReferrer object with null values', () => {
            const validData = {
                ...validPageHitRaw,
                payload: {
                    ...validPageHitRaw.payload,
                    parsedReferrer: {
                        source: null,
                        medium: null,
                        url: null
                    }
                }
            };
            expect(Value.Check(PageHitRawSchema, validData)).toBe(true);
        });

        it('should validate with parsedReferrer object with mixed null and string values', () => {
            const validData = {
                ...validPageHitRaw,
                payload: {
                    ...validPageHitRaw.payload,
                    parsedReferrer: {
                        source: 'facebook',
                        medium: null,
                        url: 'https://facebook.com'
                    }
                }
            };
            expect(Value.Check(PageHitRawSchema, validData)).toBe(true);
        });

        it('should validate without parsedReferrer field (optional)', () => {
            const validData = {
                ...validPageHitRaw,
                payload: {
                    ...validPageHitRaw.payload
                    // parsedReferrer field omitted
                }
            };
            expect(Value.Check(PageHitRawSchema, validData)).toBe(true);
        });

        it('should reject parsedReferrer with missing required fields', () => {
            const invalidData = {
                ...validPageHitRaw,
                payload: {
                    ...validPageHitRaw.payload,
                    parsedReferrer: {
                        source: 'google',
                        medium: 'organic'
                        // missing url field
                    }
                }
            };
            expect(Value.Check(PageHitRawSchema, invalidData)).toBe(false);
        });

        it('should reject parsedReferrer with invalid field types', () => {
            const invalidData = {
                ...validPageHitRaw,
                payload: {
                    ...validPageHitRaw.payload,
                    parsedReferrer: {
                        source: 123, // should be string or null
                        medium: 'organic',
                        url: 'https://google.com'
                    }
                }
            };
            expect(Value.Check(PageHitRawSchema, invalidData)).toBe(false);
        });

        it('should not be too strict about the href value', () => {
            const invalidData = {
                ...validPageHitRaw,
                payload: {
                    ...validPageHitRaw.payload,
                    href: 'not-a-url'
                }
            };
            expect(Value.Check(PageHitRawSchema, invalidData)).toBe(true);
        });

        it('should reject empty pathname', () => {
            const invalidData = {
                ...validPageHitRaw,
                payload: {
                    ...validPageHitRaw.payload,
                    pathname: ''
                }
            };
            expect(Value.Check(PageHitRawSchema, invalidData)).toBe(false);
        });

        it('should reject empty locale', () => {
            const invalidData = {
                ...validPageHitRaw,
                payload: {
                    ...validPageHitRaw.payload,
                    locale: ''
                }
            };
            expect(Value.Check(PageHitRawSchema, invalidData)).toBe(false);
        });

        it('should reject invalid member_uuid', () => {
            const invalidData = {
                ...validPageHitRaw,
                payload: {
                    ...validPageHitRaw.payload,
                    member_uuid: 'invalid-uuid'
                }
            };
            expect(Value.Check(PageHitRawSchema, invalidData)).toBe(false);
        });

        it('should reject invalid post_uuid', () => {
            const invalidData = {
                ...validPageHitRaw,
                payload: {
                    ...validPageHitRaw.payload,
                    post_uuid: 'invalid-uuid'
                }
            };
            expect(Value.Check(PageHitRawSchema, invalidData)).toBe(false);
        });
    });

    describe('meta validation', () => {
        it('should validate valid meta data', () => {
            const validData = {
                ...validPageHitRaw,
                meta: {
                    ip: '10.0.0.1',
                    'user-agent': 'Chrome/91.0.4472.124'
                }
            };
            expect(Value.Check(PageHitRawSchema, validData)).toBe(true);
        });

        it('should reject empty ip', () => {
            const invalidData = {
                ...validPageHitRaw,
                meta: {
                    ...validPageHitRaw.meta,
                    ip: ''
                }
            };
            expect(Value.Check(PageHitRawSchema, invalidData)).toBe(false);
        });

        it('should reject empty user-agent', () => {
            const invalidData = {
                ...validPageHitRaw,
                meta: {
                    ...validPageHitRaw.meta,
                    'user-agent': ''
                }
            };
            expect(Value.Check(PageHitRawSchema, invalidData)).toBe(false);
        });

        it('should reject missing ip', () => {
            const invalidData = {
                ...validPageHitRaw,
                meta: {
                    'user-agent': validPageHitRaw.meta['user-agent']
                }
            };
            expect(Value.Check(PageHitRawSchema, invalidData)).toBe(false);
        });

        it('should reject missing user-agent', () => {
            const invalidData = {
                ...validPageHitRaw,
                meta: {
                    ip: validPageHitRaw.meta.ip
                }
            };
            expect(Value.Check(PageHitRawSchema, invalidData)).toBe(false);
        });
    });

    describe('missing required fields', () => {
        it('should reject missing timestamp', () => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const {timestamp, ...invalidData} = validPageHitRaw;
            expect(Value.Check(PageHitRawSchema, invalidData)).toBe(false);
        });

        it('should reject missing payload', () => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const {payload, ...invalidData} = validPageHitRaw;
            expect(Value.Check(PageHitRawSchema, invalidData)).toBe(false);
        });

        it('should reject missing meta', () => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const {meta, ...invalidData} = validPageHitRaw;
            expect(Value.Check(PageHitRawSchema, invalidData)).toBe(false);
        });
    });

    describe('event_id validation', () => {
        it('should validate when event_id is present', () => {
            expect(Value.Check(PageHitRawSchema, validPageHitRaw)).toBe(true);
        });

        it('should validate when event_id is missing (optional field)', () => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const {event_id: eventId, ...payloadWithoutEventId} = validPageHitRaw.payload;
            const validDataWithoutEventId = {
                ...validPageHitRaw,
                payload: payloadWithoutEventId
            };
            expect(Value.Check(PageHitRawSchema, validDataWithoutEventId)).toBe(true);
        });

        it('should accept any string as event_id (validation happens during processing)', () => {
            const dataWithInvalidEventId = {
                ...validPageHitRaw,
                payload: {
                    ...validPageHitRaw.payload,
                    event_id: 'not-a-uuid'
                }
            };
            expect(Value.Check(PageHitRawSchema, dataWithInvalidEventId)).toBe(true);
        });
    });

    describe('real-world payload validation', () => {
        it('should validate typical payload with null values', () => {
            const realWorldPayload = {
                timestamp: '2024-06-24T10:30:00.000Z',
                action: 'page_hit',
                version: '1',
                site_uuid: 'c7929de8-27d7-404e-b714-0fc774f701e6',
                payload: {
                    event_id: 'c7929de8-27d7-404e-b714-0fc774f701e6',
                    member_uuid: 'undefined',
                    member_status: 'undefined',
                    post_uuid: 'undefined',
                    post_type: 'null',
                    locale: 'en-US',
                    location: null,
                    referrer: null,
                    pathname: '/',
                    href: 'https://example.com/',
                    meta: {
                        received_timestamp: null
                    }
                },
                meta: {
                    ip: '203.0.113.42',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.7204.23 Safari/537.36'
                }
            };

            expect(Value.Check(PageHitRawSchema, realWorldPayload)).toBe(true);
        });

        it('should validate payload with parsedReferrer', () => {
            const realWorldPayloadWithParsedReferrer = {
                timestamp: '2024-06-24T10:30:00.000Z',
                action: 'page_hit',
                version: '1',
                site_uuid: 'c7929de8-27d7-404e-b714-0fc774f701e6',
                payload: {
                    event_id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
                    member_uuid: 'undefined',
                    member_status: 'undefined',
                    post_uuid: 'undefined',
                    post_type: 'null',
                    locale: 'en-US',
                    location: null,
                    referrer: 'https://google.com/search?q=example',
                    parsedReferrer: {
                        source: 'google',
                        medium: 'organic',
                        url: 'https://google.com'
                    },
                    pathname: '/blog/post',
                    href: 'https://example.com/blog/post',
                    meta: {
                        received_timestamp: '2024-06-24T10:30:00.000Z'
                    }
                },
                meta: {
                    ip: '203.0.113.42',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.7204.23 Safari/537.36'
                }
            };

            expect(Value.Check(PageHitRawSchema, realWorldPayloadWithParsedReferrer)).toBe(true);
        });
    });
});
