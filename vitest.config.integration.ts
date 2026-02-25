import {defineConfig} from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['test/integration/**/*.test.ts'],
        setupFiles: ['test/setup/integration.ts'],
        restoreMocks: true,
        unstubEnvs: true,
        // Integration tests typically have longer timeouts
        testTimeout: 30000,
        hookTimeout: 30000,
        // Run integration tests sequentially to avoid shared emulator conflicts
        fileParallelism: false,
        maxWorkers: 1
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    }
});
