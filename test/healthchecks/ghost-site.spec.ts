import {test, expect} from '../fixtures';

test('should make analytics request with 202 response', async ({page}) => {
    // Wait for the analytics request
    const analyticsRequestPromise = page.waitForRequest('**/.ghost/analytics/tb/web_analytics**');
    const analyticsResponsePromise = page.waitForResponse('**/.ghost/analytics/tb/web_analytics**');
    
    await page.goto('/');
    
    // Verify the analytics request was made
    const request = await analyticsRequestPromise;
    expect(request.url()).toContain('/.ghost/analytics/tb/web_analytics');
    
    // Verify the response status is 202
    const response = await analyticsResponsePromise;
    expect(response.status()).toBe(202);
});