import {describe, it, expect, beforeAll, afterEach} from 'vitest';
import {WireMock} from '../utils/wiremock';
import path from 'path';

// Default test data that passes schema validation
const DEFAULT_QUERY_PARAMS = {
    token: 'test-token',
    name: 'analytics_events'
};

const DEFAULT_HEADERS = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    'x-site-uuid': '940b73e9-4952-4752-b23d-9486f999c47e'
};

const DEFAULT_BODY = {
    timestamp: '2025-04-14T22:16:06.095Z',
    action: 'page_hit',
    version: '1',
    session_id: '9017be4c-3065-484b-b117-9719ad1e3977',
    payload: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        locale: 'en-US',
        location: 'US',
        referrer: null,
        pathname: '/test-page',
        href: 'https://example.com/test-page',
        site_uuid: '940b73e9-4952-4752-b23d-9486f999c47e',
        post_uuid: 'undefined',
        post_type: 'null',
        member_uuid: 'undefined',
        member_status: 'free'
    }
};

interface WebAnalyticsRequestOptions {
    path: string;
    baseUrl: string;
    queryParams?: Record<string, string>;
    headers?: Record<string, string>;
    body?: Record<string, any>;
    method?: string;
}

/**
 * Helper function to make requests to the web analytics endpoint
 * Uses sensible defaults that pass schema validation, allows overrides for testing edge cases
 */
async function makeWebAnalyticsRequest(options: WebAnalyticsRequestOptions) {
    const queryParams = {...DEFAULT_QUERY_PARAMS, ...options.queryParams};
    const headers = {...DEFAULT_HEADERS, ...options.headers};
    const body = {...DEFAULT_BODY, ...options.body};
    const method = options.method || 'POST';
    const url = new URL(path.join(options.baseUrl, options.path));
    url.search = new URLSearchParams(queryParams).toString();

    return fetch(url, {
        method,
        headers,
        body: JSON.stringify(body)
    });
}

describe('E2E Tests with Fake Tinybird', () => {
    let wireMock: WireMock;

    beforeAll(async () => {
        const wiremockUrl = process.env.WIREMOCK_URL || 'http://localhost:8089';
        wireMock = new WireMock(wiremockUrl);

        // Setup default stub for Tinybird endpoint
        await wireMock.setupTinybirdStub({
            status: 202,
            responseBody: JSON.stringify({success: true}),
            responseHeaders: {'Content-Type': 'application/json'}
        });
    });

    afterEach(async () => {
        // Reset WireMock after each test to clean up stubs and request logs
        await wireMock.resetAll();

        // Re-setup the default stub
        await wireMock.setupTinybirdStub({
            status: 202,
            responseBody: JSON.stringify({success: true}),
            responseHeaders: {'Content-Type': 'application/json'}
        });
    });

    describe('POST /api/v1/page_hit', () => {
        it('should process analytics request successfully and forward to Tinybird (batch mode)', async () => {
            const response = await makeWebAnalyticsRequest({baseUrl: 'http://analytics-service:3000', path: '/api/v1/page_hit'});
    
            expect(response.status).toBe(202);
    
            const responseText = await response.text();
            expect(responseText).toBe('{"message":"Page hit event received"}');
    
            // Wait for the request to be forwarded to Tinybird (handles batch processing delay)
            const tinybirdRequests = await wireMock.waitForRequest({
                name: 'analytics_events'
            });
    
            expect(tinybirdRequests).toHaveLength(1);
    
            // Verify the request body was processed and enriched
            const requestBody = wireMock.parseRequestBody(tinybirdRequests[0]);
    
            expect(requestBody).toMatchObject({
                timestamp: DEFAULT_BODY.timestamp,
                action: 'page_hit',
                version: '1',
                // Should have session_id added by processing
                session_id: expect.any(String),
                payload: expect.objectContaining({
                    site_uuid: '940b73e9-4952-4752-b23d-9486f999c47e',
                    pathname: '/test-page',
                    href: 'https://example.com/test-page',
                    // Should have parsed user agent info
                    browser: expect.any(String),
                    os: expect.any(String),
                    device: expect.any(String),
                    // Referrer fields (null when no referrer)
                    referrerUrl: null,
                    referrerSource: null,
                    referrerMedium: null,
                    parsedReferrer: null,
                    // UTM fields
                    utm_source: null,
                    utm_medium: null,
                    utm_campaign: null,
                    utm_term: null,
                    utm_content: null
                })
            });
        });
    
        it('should process analytics request successfully and forward to Tinybird (proxy mode)', async () => {
            const response = await makeWebAnalyticsRequest({baseUrl: 'http://analytics-service-proxy:3000', path: '/api/v1/page_hit'});
    
            expect(response.status).toBe(202);
    
            const responseText = await response.text();
            expect(responseText).toBe('{"success":true}');
    
            // Wait for the request to be forwarded to Tinybird (handles batch processing delay)
            const tinybirdRequests = await wireMock.waitForRequest({
                name: 'analytics_events'
            });
    
            expect(tinybirdRequests).toHaveLength(1);
    
            // Verify the request body was processed and enriched
            const requestBody = wireMock.parseRequestBody(tinybirdRequests[0]);
    
            expect(requestBody).toMatchObject({
                timestamp: DEFAULT_BODY.timestamp,
                action: 'page_hit',
                version: '1',
                // Should have session_id added by processing
                session_id: expect.any(String),
                payload: expect.objectContaining({
                    site_uuid: '940b73e9-4952-4752-b23d-9486f999c47e',
                    pathname: '/test-page',
                    href: 'https://example.com/test-page',
                    // Should have parsed user agent info
                    browser: expect.any(String),
                    os: expect.any(String),
                    device: expect.any(String),
                    // Referrer fields (null when no referrer)
                    referrerUrl: null,
                    referrerSource: null,
                    referrerMedium: null,
                    parsedReferrer: null,
                    // UTM fields
                    utm_source: null,
                    utm_medium: null,
                    utm_campaign: null,
                    utm_term: null,
                    utm_content: null
                })
            });
        });    
    });
});
