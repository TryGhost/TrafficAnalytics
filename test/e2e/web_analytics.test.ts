import {describe, it, expect} from 'vitest';

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
    const url = `http://localhost:3000/tb/web_analytics?${queryString}`;

    return fetch(url, {
        method,
        headers,
        body: JSON.stringify(body)
    });
}

describe('E2E /tb/web_analytics', () => {
    it('should process analytics request successfully', async () => {
        const response = await makeWebAnalyticsRequest();

        expect(response.status).toBe(200);
        
        const responseText = await response.text();
        expect(responseText).toBe('Hello World - From the local proxy');
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
            const url = `http://localhost:3000/tb/web_analytics?${queryString}`;
            
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
});