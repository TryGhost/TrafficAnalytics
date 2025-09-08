import {describe, it, expect, vi, beforeEach} from 'vitest';
import {FastifyRequest} from '../../../../../src/types';
import * as urlReferrerModule from '../../../../../src/services/proxy/processors/url-referrer.js';
import type {FastifyRequest as FastifyOriginalRequest} from 'fastify';

// Mock the @tryghost/referrer-parser module
vi.mock('@tryghost/referrer-parser', async () => {
    const ReferrerParser = vi.fn().mockImplementation(() => ({
        parse: vi.fn().mockImplementation((url, source, medium) => ({
            referrerUrl: url,
            referrerSource: source,
            referrerMedium: medium || 'unknown'
        }))
    }));

    return {
        ReferrerParser
    };
});

describe('Referrer Parser', () => {
    let request: FastifyRequest;

    beforeEach(() => {
        vi.clearAllMocks();

        // Create a partial FastifyRequest with the required properties for our tests
        request = {
            headers: {},
            body: {
                payload: {
                    parsedReferrer: {
                        url: 'https://www.google.com/search?q=ghost+cms',
                        source: 'Google',
                        medium: 'search'
                    }
                }
            },
            query: {},
            id: '1',
            params: {},
            raw: {} as FastifyOriginalRequest['raw'],
            log: {} as FastifyOriginalRequest['log'],
            url: '/',
            method: 'GET',
            server: {} as FastifyOriginalRequest['server'],
            ip: '127.0.0.1',
            hostname: 'localhost'
        } as unknown as FastifyRequest;
    });

    it('should parse referrer data and add it to the payload', () => {
        urlReferrerModule.parseReferrer(request);

        expect(request.body.payload.referrerSource).toBe('Google');
        expect(request.body.payload.referrerUrl).toBe('https://www.google.com/search?q=ghost+cms');
        expect(request.body.payload.referrerMedium).toBe('search');
    });

    it('should skip processing if referrer header is missing', () => {
        const testRequest = structuredClone(request);
        delete testRequest.body.payload.parsedReferrer;

        urlReferrerModule.parseReferrer(testRequest);

        expect(testRequest.body.payload.referrerSource).toBeUndefined();
        expect(testRequest.body.payload.referrerUrl).toBeUndefined();
        expect(testRequest.body.payload.referrerMedium).toBeUndefined();
    });

    it('should handle non-object parsedReferrer headers', () => {
        const testRequest = structuredClone(request);
        // Use type assertion to handle the test case
        testRequest.body.payload.parsedReferrer = 'not-an-object' as unknown as { source: string | null; medium: string | null; url: string | null; };

        urlReferrerModule.parseReferrer(testRequest);

        expect(testRequest.body.payload.referrerSource).toBeUndefined();
        expect(testRequest.body.payload.referrerUrl).toBeUndefined();
        expect(testRequest.body.payload.referrerMedium).toBeUndefined();
    });

    it('should handle missing referrer properties', () => {
        const testRequest = structuredClone(request);
        // Use empty object with type assertion
        testRequest.body.payload.parsedReferrer = {} as { source: string | null; medium: string | null; url: string | null; };

        urlReferrerModule.parseReferrer(testRequest);

        expect(testRequest.body.payload.referrerSource).toBeUndefined();
        expect(testRequest.body.payload.referrerUrl).toBeUndefined();
        expect(testRequest.body.payload.referrerMedium).toBeUndefined();
    });

    it('should parse UTM parameters from parsedReferrer', () => {
        const testRequest = structuredClone(request);
        testRequest.body.payload.parsedReferrer = {
            url: 'https://example.com',
            source: 'newsletter',
            medium: 'email',
            utmSource: 'newsletter',
            utmMedium: 'email',
            utmCampaign: 'summer-sale',
            utmTerm: 'ghost-cms',
            utmContent: 'header-link'
        };

        urlReferrerModule.parseReferrer(testRequest);

        expect(testRequest.body.payload.utmSource).toBe('newsletter');
        expect(testRequest.body.payload.utmMedium).toBe('email');
        expect(testRequest.body.payload.utmCampaign).toBe('summer-sale');
        expect(testRequest.body.payload.utmTerm).toBe('ghost-cms');
        expect(testRequest.body.payload.utmContent).toBe('header-link');
    });

    it('should handle UTM parameters with null values', () => {
        const testRequest = structuredClone(request);
        testRequest.body.payload.parsedReferrer = {
            url: 'https://example.com',
            source: 'direct',
            medium: null,
            utmSource: null,
            utmMedium: null,
            utmCampaign: null,
            utmTerm: null,
            utmContent: null
        };

        urlReferrerModule.parseReferrer(testRequest);

        expect(testRequest.body.payload.utmSource).toBeNull();
        expect(testRequest.body.payload.utmMedium).toBeNull();
        expect(testRequest.body.payload.utmCampaign).toBeNull();
        expect(testRequest.body.payload.utmTerm).toBeNull();
        expect(testRequest.body.payload.utmContent).toBeNull();
    });

    it('should handle partial UTM parameters', () => {
        const testRequest = structuredClone(request);
        testRequest.body.payload.parsedReferrer = {
            url: 'https://example.com',
            source: 'google',
            medium: 'cpc',
            utmSource: 'google',
            utmMedium: 'cpc',
            utmCampaign: 'brand-awareness'
            // utmTerm and utmContent are missing
        };

        urlReferrerModule.parseReferrer(testRequest);

        expect(testRequest.body.payload.utmSource).toBe('google');
        expect(testRequest.body.payload.utmMedium).toBe('cpc');
        expect(testRequest.body.payload.utmCampaign).toBe('brand-awareness');
        expect(testRequest.body.payload.utmTerm).toBeNull();
        expect(testRequest.body.payload.utmContent).toBeNull();
    });

    it('should handle missing UTM parameters gracefully', () => {
        const testRequest = structuredClone(request);
        // parsedReferrer without any UTM fields
        testRequest.body.payload.parsedReferrer = {
            url: 'https://www.google.com/search?q=ghost+cms',
            source: 'Google',
            medium: 'search'
        };

        urlReferrerModule.parseReferrer(testRequest);

        expect(testRequest.body.payload.utmSource).toBeNull();
        expect(testRequest.body.payload.utmMedium).toBeNull();
        expect(testRequest.body.payload.utmCampaign).toBeNull();
        expect(testRequest.body.payload.utmTerm).toBeNull();
        expect(testRequest.body.payload.utmContent).toBeNull();
    });
});
