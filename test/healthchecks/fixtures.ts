import {test as base} from '@playwright/test';

export const test = base.extend({
    page: async ({page}, use) => {
        const wafBypassToken = process.env.HEALTHCHECK_WAF_BYPASS_TOKEN;

        if (!wafBypassToken) {
            throw new Error('HEALTHCHECK_WAF_BYPASS_TOKEN is required for healthchecks');
        }

        // Authenticate only the analytics request as synthetic monitoring. The
        // WAF allow rule validates this token without changing Ghost routing.
        await page.route('**/.ghost/analytics/**', async (route) => {
            await route.continue({
                headers: {
                    ...route.request().headers(),
                    'X-Ghost-Analytics-Healthcheck-Token': wafBypassToken
                }
            });
        });

        // Set synthetic monitoring flag before each test
        await page.addInitScript(() => {
            window.__GHOST_SYNTHETIC_MONITORING__ = true;
        });

        await use(page);
    }
});

export {expect} from '@playwright/test';