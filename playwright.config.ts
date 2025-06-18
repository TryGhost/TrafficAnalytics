import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
    testDir: './test/healthchecks',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: 0,
    timeout: 60000, // 60 seconds
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
  
    use: {
        baseURL: process.env.TEST_BASE_URL || 'https://main.ghost.org',
        trace: 'on-first-retry'
    },

    projects: [
        {
            name: 'chromium',
            use: {...devices['Desktop Chrome']}
        },
        {
            name: 'firefox',
            use: {...devices['Desktop Firefox']}
        },
        {
            name: 'webkit',
            use: {...devices['Desktop Safari']}
        }
    ]
});