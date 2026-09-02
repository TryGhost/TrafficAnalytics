import {defineConfig} from 'vitest/config';

// One config for every suite. Each suite is a project so `--project` selects
// it (see the test scripts in package.json), and a single run can span more
// than one: CI measures combined unit + integration coverage that way.
export default defineConfig({
    test: {
        coverage: {
            // Enabled by the --coverage flag on the combined run only, so the
            // thresholds below are never applied to a single suite.
            provider: 'v8',
            reporter: ['text', 'json', 'cobertura'],
            include: ['src/**/*.ts'],
            all: true,
            exclude: ['**/node_modules/**', 'dist/**', '**/types/**'],
            reportsDirectory: './coverage',
            // Do not rmdir reportsDirectory on start: in CI ./coverage is a
            // bind mount and rmdir of a mount point is EBUSY. The report files
            // are simply overwritten each run.
            clean: false,
            thresholds: {
                // Floors set a couple of points below measured combined
                // coverage (lines 95.25%, statements 95.27%, functions 96.73%,
                // branches 88.28%) for stability. Raise, never lower.
                lines: 93,
                functions: 94,
                branches: 85,
                statements: 93
            }
        },
        projects: [
            {
                test: {
                    name: 'unit',
                    environment: 'node',
                    include: ['test/unit/**/*.test.ts'],
                    restoreMocks: true,
                    unstubEnvs: true
                }
            },
            {
                test: {
                    name: 'integration',
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
                }
            },
            {
                test: {
                    name: 'e2e',
                    environment: 'node',
                    include: ['test/e2e/**/*.test.ts'],
                    restoreMocks: true,
                    unstubEnvs: true
                }
            }
        ]
    }
});
