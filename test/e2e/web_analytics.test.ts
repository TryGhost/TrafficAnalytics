import {describe, it, expect} from 'vitest';

describe('E2E /tb/web_analytics', () => {
    it('should process analytics request successfully', async () => {
        const response = await fetch('http://localhost:3000/tb/web_analytics?token=test-token&name=pageview', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                Referer: 'https://example.com/blog/post',
                'x-site-uuid': '12345678-1234-1234-1234-123456789012'
            },
            body: JSON.stringify({
                payload: {
                    url: 'https://example.com/test-page',
                    timestamp: '2024-01-01T00:00:00Z'
                }
            })
        });

        expect(response.status).toBe(200);
        
        const responseText = await response.text();
        expect(responseText).toBe('Hello World - From the local proxy');
    });
});