import {test, expect} from './fixtures';

test.describe('Ghost site healthcheck', () => {
    test('should make analytics request with 202 response', async ({page, baseURL}) => {
        const analyticsRequestPromise = page.waitForRequest('**/.ghost/analytics/**', {timeout: 45000});
        const analyticsResponsePromise = page.waitForResponse('**/.ghost/analytics/**', {timeout: 45000});

        await page.goto(baseURL!);

        const request = await analyticsRequestPromise;
        expect(request.url()).toContain('/.ghost/analytics/');

        const response = await analyticsResponsePromise;
        expect(response.status()).toBe(202);
    });
});
