import {test, expect} from './fixtures';

test.describe('Ghost site healthcheck', () => {
    test('should make analytics request with 202 response', async ({page, baseURL}) => {
        // Wait for the analytics request
        const analyticsRequestPromise = page.waitForRequest('**/.ghost/analytics/tb/web_analytics**');
        const analyticsResponsePromise = page.waitForResponse('**/.ghost/analytics/tb/web_analytics**');
        
        await page.goto(baseURL!);
        
        // Verify the analytics request was made
        const request = await analyticsRequestPromise;
        expect(request.url()).toContain('/.ghost/analytics/tb/web_analytics');
        
        // Verify the response status is 202
        const response = await analyticsResponsePromise;
        expect(response.status()).toBe(202);
    });
});