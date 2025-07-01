import {describe, it, expect, beforeAll, afterEach} from 'vitest';
import {WireMock} from '../utils/wiremock';

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
    url?: string;
    queryParams?: Record<string, string>;
    headers?: Record<string, string>;
    body?: Record<string, any>;
    method?: string;
}

/**
 * Helper function to make requests to the web analytics endpoint
 * Uses sensible defaults that pass schema validation, allows overrides for testing edge cases
 */
async function makeWebAnalyticsRequest(options: WebAnalyticsRequestOptions = {}) {
    const queryParams = {...DEFAULT_QUERY_PARAMS, ...options.queryParams};
    const headers = {...DEFAULT_HEADERS, ...options.headers};
    const body = {...DEFAULT_BODY, ...options.body};
    const method = options.method || 'POST';

    // Build query string
    const queryString = new URLSearchParams(queryParams).toString();

    const baseUrl = options.url || process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:3000';
    const url = `${baseUrl}/tb/web_analytics?${queryString}`;

    return fetch(url, {
        method,
        headers,
        body: JSON.stringify(body)
    });
}

describe('E2E /tb/web_analytics', () => {
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

    it('should process analytics request successfully and forward to Tinybird (batch mode)', async () => {
        const response = await makeWebAnalyticsRequest({url: 'http://analytics-service:3000'});

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
                device: expect.any(String)
            })
        });
    });

    describe('validation failures', () => {
        it('should reject requests with invalid name parameter', async () => {
            const response = await makeWebAnalyticsRequest({
                queryParams: {name: 'invalid_name'}
            });

            expect(response.status).toBe(400);
        });

        it('should reject requests without x-site-uuid header', async () => {
            const response = await makeWebAnalyticsRequest({
                headers: {'x-site-uuid': ''}
            });

            expect(response.status).toBe(400);
        });

        it('should reject requests with invalid x-site-uuid format', async () => {
            const response = await makeWebAnalyticsRequest({
                headers: {'x-site-uuid': 'not-a-uuid'}
            });

            expect(response.status).toBe(400);
        });
    });
});
