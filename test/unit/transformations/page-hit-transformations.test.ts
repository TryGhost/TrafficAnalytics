import {describe, it, expect} from 'vitest';
import {pageHitRawPayloadFromRequest} from '../../../src/transformations/page-hit-transformations';
import {PageHitRequestType} from '../../../src/schemas';

describe('pageHitRawPayloadFromRequest', () => {
    function createPageHitRequest() {
        return {
            ip: '192.168.1.1',
            headers: {
                'x-site-uuid': '12345678-1234-1234-1234-123456789012',
                'content-type': 'application/json',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            },
            body: {
                timestamp: '2024-01-01T00:00:00.000Z',
                action: 'page_hit',
                version: '1',
                payload: {
                    event_id: 'test-event-id',
                    member_uuid: 'member-uuid-123',
                    member_status: 'free',
                    post_uuid: 'post-uuid-456',
                    post_type: 'post',
                    locale: 'en-US',
                    location: 'homepage',
                    referrer: 'https://google.com',
                    parsedReferrer: {
                        source: 'google',
                        medium: 'organic',
                        url: 'https://google.com'
                    },
                    pathname: '/blog/post',
                    href: 'https://example.com/blog/post'
                }
            }
        } as PageHitRequestType;
    }

    it('should transform request to PageHitRaw with all fields present', () => {
        const request = createPageHitRequest();
        const result = pageHitRawPayloadFromRequest(request);

        expect(result).toEqual({
            timestamp: '2024-01-01T00:00:00.000Z',
            action: 'page_hit',
            version: '1',
            site_uuid: '12345678-1234-1234-1234-123456789012',
            payload: {
                event_id: 'test-event-id',
                member_uuid: 'member-uuid-123',
                member_status: 'free',
                post_uuid: 'post-uuid-456',
                post_type: 'post',
                locale: 'en-US',
                location: 'homepage',
                referrer: 'https://google.com',
                parsedReferrer: {
                    source: 'google',
                    medium: 'organic',
                    url: 'https://google.com'
                },
                pathname: '/blog/post',
                href: 'https://example.com/blog/post',
                utmSource: null,
                utmMedium: null,
                utmCampaign: null,
                utmTerm: null,
                utmContent: null
            },
            meta: {
                ip: '192.168.1.1',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        });
    });

    describe('Event ID', () => {
        const uuidMatcher = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        it('should generate random UUID when event_id is undefined', () => {
            const request = createPageHitRequest();
            request.body.payload.event_id = undefined;

            const result = pageHitRawPayloadFromRequest(request);

            expect(result.payload.event_id).toBeDefined();
            expect(typeof result.payload.event_id).toBe('string');
            expect(result.payload.event_id).toMatch(uuidMatcher);
        });

        it('should generate random UUID when event_id is null', () => {
            const request = createPageHitRequest();
            request.body.payload.event_id = null as any;

            const result = pageHitRawPayloadFromRequest(request);

            expect(result.payload.event_id).toBeDefined();
            expect(typeof result.payload.event_id).toBe('string');
            expect(result.payload.event_id).toMatch(uuidMatcher);
        });

        it('should generate random UUID when event_id is empty string', () => {
            const request = createPageHitRequest();
            request.body.payload.event_id = '';

            const result = pageHitRawPayloadFromRequest(request);

            expect(result.payload.event_id).toBeDefined();
            expect(typeof result.payload.event_id).toBe('string');
            expect(result.payload.event_id).toMatch(uuidMatcher);
        });
    });

    it('should set referrer to null when undefined', () => {
        const request = createPageHitRequest();
        request.body.payload.referrer = undefined;

        const result = pageHitRawPayloadFromRequest(request);

        expect(result.payload.referrer).toBeNull();
    });

    it('should preserve referrer when it has a value', () => {
        const request = createPageHitRequest();
        request.body.payload.referrer = 'https://facebook.com';

        const result = pageHitRawPayloadFromRequest(request);

        expect(result.payload.referrer).toBe('https://facebook.com');
    });

    it('should preserve referrer when it is null', () => {
        const request = createPageHitRequest();
        request.body.payload.referrer = null;

        const result = pageHitRawPayloadFromRequest(request);

        expect(result.payload.referrer).toBeNull();
    });

    it('should handle undefined member_uuid', () => {
        const request = createPageHitRequest();
        request.body.payload.member_uuid = 'undefined';

        const result = pageHitRawPayloadFromRequest(request);

        expect(result.payload.member_uuid).toBe('undefined');
    });

    it('should handle valid member_uuid', () => {
        const request = createPageHitRequest();
        const uuid = '87654321-4321-4321-4321-210987654321';
        request.body.payload.member_uuid = uuid;

        const result = pageHitRawPayloadFromRequest(request);

        expect(result.payload.member_uuid).toBe(uuid);
    });

    it('should handle undefined member_status', () => {
        const request = createPageHitRequest();
        request.body.payload.member_status = 'undefined';

        const result = pageHitRawPayloadFromRequest(request);

        expect(result.payload.member_status).toBe('undefined');
    });

    it('should handle valid member_status', () => {
        const request = createPageHitRequest();
        request.body.payload.member_status = 'paid';

        const result = pageHitRawPayloadFromRequest(request);

        expect(result.payload.member_status).toBe('paid');
    });

    it('should handle undefined post_uuid', () => {
        const request = createPageHitRequest();
        request.body.payload.post_uuid = 'undefined';

        const result = pageHitRawPayloadFromRequest(request);

        expect(result.payload.post_uuid).toBe('undefined');
    });

    it('should handle valid post_uuid', () => {
        const request = createPageHitRequest();
        const uuid = '11111111-2222-3333-4444-555555555555';
        request.body.payload.post_uuid = uuid;

        const result = pageHitRawPayloadFromRequest(request);

        expect(result.payload.post_uuid).toBe(uuid);
    });

    it('should handle all post_type values', () => {
        const postTypes = ['null', 'post', 'page'] as const;

        postTypes.forEach((postType) => {
            const request = createPageHitRequest();
            request.body.payload.post_type = postType;

            const result = pageHitRawPayloadFromRequest(request);

            expect(result.payload.post_type).toBe(postType);
        });
    });

    it('should handle null location', () => {
        const request = createPageHitRequest();
        request.body.payload.location = null;

        const result = pageHitRawPayloadFromRequest(request);

        expect(result.payload.location).toBeNull();
    });

    it('should handle string location', () => {
        const request = createPageHitRequest();
        request.body.payload.location = 'blog-section';

        const result = pageHitRawPayloadFromRequest(request);

        expect(result.payload.location).toBe('blog-section');
    });

    it('should handle parsedReferrer with all fields', () => {
        const request = createPageHitRequest();
        const parsedReferrer = {source: 'twitter', medium: 'social', url: 'https://twitter.com'};
        request.body.payload.parsedReferrer = parsedReferrer;

        const result = pageHitRawPayloadFromRequest(request);

        expect(result.payload.parsedReferrer).toEqual(parsedReferrer);
    });

    it('should handle parsedReferrer with null values', () => {
        const request = createPageHitRequest();
        const parsedReferrer = {source: null, medium: null, url: null};
        request.body.payload.parsedReferrer = parsedReferrer;

        const result = pageHitRawPayloadFromRequest(request);

        expect(result.payload.parsedReferrer).toEqual(parsedReferrer);
    });

    it('should handle parsedReferrer with mixed null and string values', () => {
        const request = createPageHitRequest();
        const parsedReferrer = {source: 'reddit', medium: null, url: 'https://reddit.com'};
        request.body.payload.parsedReferrer = parsedReferrer;

        const result = pageHitRawPayloadFromRequest(request);

        expect(result.payload.parsedReferrer).toEqual(parsedReferrer);
    });

    it('should handle undefined parsedReferrer', () => {
        const request = createPageHitRequest();
        request.body.payload.parsedReferrer = undefined;

        const result = pageHitRawPayloadFromRequest(request);

        expect(result.payload.parsedReferrer).toBeUndefined();
    });

    it('should correctly map meta fields from request', () => {
        const initialRequest = createPageHitRequest();
        const request = {
            ...initialRequest,
            ip: '10.0.0.1',
            headers: {
                ...initialRequest.headers,
                'user-agent': 'Custom User Agent String'
            }
        } as PageHitRequestType;

        const result = pageHitRawPayloadFromRequest(request);

        expect(result.meta).toEqual({
            ip: '10.0.0.1',
            'user-agent': 'Custom User Agent String'
        });
    });

    it('should handle complex real-world request', () => {
        const request = {
            ip: '203.0.113.42',
            headers: {
                'x-site-uuid': 'c7929de8-27d7-404e-b714-0fc774f701e6',
                'content-type': 'application/json',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.7204.23 Safari/537.36'
            },
            body: {
                timestamp: '2024-03-15T14:30:25.123Z',
                action: 'page_hit',
                version: '1',
                payload: {
                    event_id: undefined,
                    member_uuid: 'undefined',
                    member_status: 'undefined',
                    post_uuid: 'undefined',
                    post_type: 'null',
                    locale: 'en-US',
                    location: null,
                    referrer: null,
                    parsedReferrer: {
                        source: null,
                        medium: null,
                        url: null
                    },
                    pathname: '/',
                    href: 'https://traffic-analytics.ghst.pro/'
                }
            }
        } as PageHitRequestType;

        const result = pageHitRawPayloadFromRequest(request);

        expect(result.timestamp).toBe('2024-03-15T14:30:25.123Z');
        expect(result.action).toBe('page_hit');
        expect(result.version).toBe('1');
        expect(result.site_uuid).toBe('c7929de8-27d7-404e-b714-0fc774f701e6');
        expect(result.payload.event_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        expect(result.payload.member_uuid).toBe('undefined');
        expect(result.payload.member_status).toBe('undefined');
        expect(result.payload.post_uuid).toBe('undefined');
        expect(result.payload.post_type).toBe('null');
        expect(result.payload.locale).toBe('en-US');
        expect(result.payload.location).toBeNull();
        expect(result.payload.referrer).toBeNull();
        expect(result.payload.parsedReferrer).toEqual({
            source: null,
            medium: null,
            url: null
        });
        expect(result.payload.pathname).toBe('/');
        expect(result.payload.href).toBe('https://traffic-analytics.ghst.pro/');
        expect(result.meta.ip).toBe('203.0.113.42');
        expect(result.meta['user-agent']).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.7204.23 Safari/537.36');
    });

    describe('UTM parameter handling', () => {
        it('should extract UTM parameters from top level payload', () => {
            const request = createPageHitRequest();
            request.body.payload.parsedReferrer = {
                source: 'google',
                medium: 'cpc',
                url: 'https://google.com'
            };
            request.body.payload.utmSource = 'google';
            request.body.payload.utmMedium = 'cpc';
            request.body.payload.utmCampaign = 'brand-campaign';
            request.body.payload.utmTerm = 'ghost-cms';
            request.body.payload.utmContent = 'ad-1';

            const result = pageHitRawPayloadFromRequest(request);

            // UTM params should be at top level
            expect(result.payload.utmSource).toBe('google');
            expect(result.payload.utmMedium).toBe('cpc');
            expect(result.payload.utmCampaign).toBe('brand-campaign');
            expect(result.payload.utmTerm).toBe('ghost-cms');
            expect(result.payload.utmContent).toBe('ad-1');

            // parsedReferrer should contain only referrer data
            expect(result.payload.parsedReferrer).toEqual({
                source: 'google',
                medium: 'cpc',
                url: 'https://google.com'
            });
        });

        it('should handle null UTM parameters', () => {
            const request = createPageHitRequest();
            request.body.payload.parsedReferrer = {
                source: 'direct',
                medium: null,
                url: null
            };
            request.body.payload.utmSource = null;
            request.body.payload.utmMedium = null;
            request.body.payload.utmCampaign = null;
            request.body.payload.utmTerm = null;
            request.body.payload.utmContent = null;

            const result = pageHitRawPayloadFromRequest(request);

            // UTM params should be null at top level
            expect(result.payload.utmSource).toBeNull();
            expect(result.payload.utmMedium).toBeNull();
            expect(result.payload.utmCampaign).toBeNull();
            expect(result.payload.utmTerm).toBeNull();
            expect(result.payload.utmContent).toBeNull();
        });

        it('should handle missing UTM parameters', () => {
            const request = createPageHitRequest();
            request.body.payload.parsedReferrer = {
                source: 'twitter',
                medium: 'social',
                url: 'https://twitter.com'
            };
            // Don't set UTM params - they should default to null

            const result = pageHitRawPayloadFromRequest(request);

            // UTM params should be null when missing
            expect(result.payload.utmSource).toBeNull();
            expect(result.payload.utmMedium).toBeNull();
            expect(result.payload.utmCampaign).toBeNull();
            expect(result.payload.utmTerm).toBeNull();
            expect(result.payload.utmContent).toBeNull();
        });

        it('should handle undefined parsedReferrer', () => {
            const request = createPageHitRequest();
            request.body.payload.parsedReferrer = undefined;
            // Don't set UTM params - they should default to null

            const result = pageHitRawPayloadFromRequest(request);

            // UTM params should be null when not provided
            expect(result.payload.utmSource).toBeNull();
            expect(result.payload.utmMedium).toBeNull();
            expect(result.payload.utmCampaign).toBeNull();
            expect(result.payload.utmTerm).toBeNull();
            expect(result.payload.utmContent).toBeNull();
        });
    });
});
