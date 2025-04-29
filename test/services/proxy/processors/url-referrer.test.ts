import {describe, it, expect, vi, beforeEach} from 'vitest';
import {FastifyRequest} from '../../../../src/types';
import * as urlReferrerModule from '../../../../src/services/proxy/processors/url-referrer.js';
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
            headers: {
                parsedReferrer: {
                    referrerSource: 'Google',
                    referrerMedium: 'search',
                    referrerUrl: 'https://www.google.com/search?q=ghost+cms'
                }
            },
            body: {
                payload: {
                    meta: {}
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

        expect(request.body.payload.meta.referrerSource).toBe('Google');
        expect(request.body.payload.meta.referrerMedium).toBe('search');
        expect(request.body.payload.meta.referrerUrl).toBe('https://www.google.com/search?q=ghost+cms');
    });

    it('should skip processing if referrer header is missing', () => {
        const testRequest = structuredClone(request);
        if (testRequest.headers) {
            delete testRequest.headers.parsedReferrer;
        }
        testRequest.body.payload = {};

        urlReferrerModule.parseReferrer(testRequest);

        expect(testRequest.body.payload.meta).toBeUndefined();
    });

    it('should handle non-object parsedReferrer headers', () => {
        const testRequest = structuredClone(request);
        if (testRequest.headers) {
            // Use type assertion to handle the test case
            testRequest.headers.parsedReferrer = 'not-an-object' as unknown as typeof testRequest.headers.parsedReferrer;
        }
        testRequest.body.payload = {};

        urlReferrerModule.parseReferrer(testRequest);

        expect(testRequest.body.payload.meta).toBeUndefined();
    });

    it('should handle missing referrer properties', () => {
        const testRequest = structuredClone(request);
        if (testRequest.headers) {
            // Use empty object with type assertion
            testRequest.headers.parsedReferrer = {} as typeof testRequest.headers.parsedReferrer;
        }
        testRequest.body.payload = {};

        urlReferrerModule.parseReferrer(testRequest);

        expect(testRequest.body.payload.meta).toBeUndefined();
    });
});
