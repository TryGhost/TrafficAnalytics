import {defineConfig} from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['test/integration/**/*.test.ts'],
        // Integration tests typically have longer timeouts
        testTimeout: 30000,
        hookTimeout: 30000,
        // Run integration tests sequentially to avoid conflicts
        pool: 'forks',
        poolOptions: {
            forks: {
                singleFork: true
            }
        }
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    }
});