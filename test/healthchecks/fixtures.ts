import {test as base} from '@playwright/test';

export const test = base.extend({
    page: async ({page, baseURL}, use) => {
        const wafBypassToken = process.env.HEALTHCHECK_WAF_BYPASS_TOKEN;

        if (!wafBypassToken) {
            throw new Error('HEALTHCHECK_WAF_BYPASS_TOKEN is required for healthchecks');
        }

        if (!baseURL) {
            throw new Error('A baseURL is required for healthchecks');
        }
        const trustedHealthcheckOrigin = new URL(baseURL).origin;

        // Authenticate analytics requests only on the configured healthcheck
        // origin. Redirects are rechecked before receiving the token.
        await page.route('**/.ghost/analytics/**', async (route) => {
            if (new URL(route.request().url()).origin !== trustedHealthcheckOrigin) {
                await route.continue();
                return;
            }

            const response = await route.fetch({
                headers: {
                    ...route.request().headers(),
                    'X-Ghost-Analytics-Healthcheck-Token': wafBypassToken
                },
                maxRedirects: 0
            });
            await route.fulfill({response});
        });

        // Set synthetic monitoring flag before each test
        await page.addInitScript(() => {
            window.__GHOST_SYNTHETIC_MONITORING__ = true;
        });

        await use(page);
    }
});

export {expect} from '@playwright/test';