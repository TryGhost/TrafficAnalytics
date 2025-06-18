import { test as base } from '@playwright/test';

export const test = base.extend({
    page: async ({ page }, use) => {
        // Set synthetic monitoring flag before each test
        await page.addInitScript(() => {
            window.__GHOST_SYNTHETIC_MONITORING__ = true;
        });
        
        await use(page);
    }
});

export { expect } from '@playwright/test';