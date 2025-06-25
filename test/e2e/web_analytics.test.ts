import {describe, it, expect, beforeAll, afterEach} from 'vitest';
import {WireMock} from '../utils/wiremock';

// Default test data that passes schema validation
const DEFAULT_QUERY_PARAMS = {
    token: 'test-token',
    name: 'analytics_events_test'
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
    
    const baseUrl = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3000';
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
            status: 200,
            responseBody: JSON.stringify({success: true}),
            responseHeaders: {'Content-Type': 'application/json'}
        });
    });

    afterEach(async () => {
        // Reset WireMock after each test to clean up stubs and request logs
        await wireMock.resetAll();
        
        // Re-setup the default stub
        await wireMock.setupTinybirdStub({
            status: 200,
            responseBody: JSON.stringify({success: true}),
            responseHeaders: {'Content-Type': 'application/json'}
        });
    });
    it('should process analytics request successfully and forward to Tinybird', async () => {
        const response = await makeWebAnalyticsRequest();

        expect(response.status).toBe(200);
        
        const responseText = await response.text();
        expect(responseText).toBe('{"success":true}');

        // Verify the request was forwarded to Tinybird
        const tinybirdRequests = await wireMock.verifyTinybirdRequest({
            token: 'test-token',
            name: 'analytics_events_test'
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

        it('should reject requests without required token parameter', async () => {
            const response = await makeWebAnalyticsRequest({
                queryParams: {token: ''}
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

        it('should reject requests with missing required body fields', async () => {
            // Send incomplete body directly without merging with defaults
            const queryString = new URLSearchParams(DEFAULT_QUERY_PARAMS).toString();
            const baseUrl = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3000';
            const url = `${baseUrl}/tb/web_analytics?${queryString}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: DEFAULT_HEADERS,
                body: JSON.stringify({timestamp: '2025-04-14T22:16:06.095Z'}) // Missing action, version, payload, etc.
            });

            expect(response.status).toBe(400);
        });

        it('should reject requests with invalid timestamp format', async () => {
            const response = await makeWebAnalyticsRequest({
                body: {timestamp: 'not-a-timestamp'}
            });

            expect(response.status).toBe(400);
        });
    });

    it('should accept real healthcheck request with null location and undefined member_status', async () => {
        // This is the exact request body that was causing 400 responses in healthchecks
        const healthcheckBody = {
            timestamp: '2025-06-23T23:23:55.030Z',
            action: 'page_hit',
            version: '1',
            payload: {
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
            }
        };

        const queryString = new URLSearchParams(DEFAULT_QUERY_PARAMS).toString();
        const baseUrl = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3000';
        const url = `${baseUrl}/tb/web_analytics?${queryString}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                ...DEFAULT_HEADERS,
                'x-site-uuid': 'c7929de8-27d7-404e-b714-0fc774f701e6'
            },
            body: JSON.stringify(healthcheckBody)
        });

        expect(response.status).toBe(200);
        
        const responseText = await response.text();
        expect(responseText).toBe('{"success":true}');

        // Verify the request was forwarded to Tinybird with processed data
        const tinybirdRequests = await wireMock.verifyTinybirdRequest({
            token: 'test-token',
            name: 'analytics_events_test'
        });

        expect(tinybirdRequests).toHaveLength(1);

        // Verify healthcheck request body was processed correctly
        const requestBody = wireMock.parseRequestBody(tinybirdRequests[0]);
        expect(requestBody).toMatchObject({
            timestamp: healthcheckBody.timestamp,
            action: 'page_hit',
            version: '1',
            // Should have session_id added by processing  
            session_id: expect.any(String),
            payload: expect.objectContaining({
                site_uuid: 'c7929de8-27d7-404e-b714-0fc774f701e6',
                location: null,
                member_status: 'undefined',
                // Should have parsed user agent info
                browser: expect.any(String),
                os: expect.any(String)
            })
        });
    });

    it('should process analytics request and BatchWorker should post processed event to Tinybird', async () => {
        // Make a request to the analytics endpoint
        const response = await makeWebAnalyticsRequest();
        expect(response.status).toBe(200);

        // Verify BatchWorker posted the processed event to Tinybird
        const tinybirdRequests = await wireMock.verifyTinybirdRequest({
            token: 'test-token',
            name: 'analytics_events_test'
        });

        // Should have at least 1 request (may have more due to existing events in queue)
        expect(tinybirdRequests.length).toBeGreaterThanOrEqual(1);
        
        // Find a BatchWorker request (it should have processed/transformed data with user agent parsing)
        const batchWorkerRequest = tinybirdRequests.find((request) => {
            const body = wireMock.parseRequestBody(request);
            return body && body.session_id && body.payload && body.payload.os && body.payload.browser && body.payload.device;
        });

        expect(batchWorkerRequest).toBeDefined();
        
        const requestBody = wireMock.parseRequestBody(batchWorkerRequest!);
        
        // Verify the event was transformed correctly by BatchWorker
        expect(requestBody).toMatchObject({
            timestamp: expect.any(String),
            action: 'page_hit',
            version: '1',
            session_id: expect.any(String), // Generated by user signature service
            payload: expect.objectContaining({
                site_uuid: expect.any(String),
                locale: expect.any(String),
                pathname: expect.any(String),
                href: expect.any(String),
                // Verify user agent was parsed by BatchWorker
                os: expect.any(String),
                browser: expect.any(String),
                device: expect.any(String)
            })
        });

        // Verify meta fields are not included in the processed event
        expect(requestBody).not.toHaveProperty('meta');
        expect(requestBody.payload).not.toHaveProperty('meta');
    });
});