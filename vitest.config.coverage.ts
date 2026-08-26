import {defineConfig} from 'vitest/config';
import {resolve} from 'path';

// Combined coverage config: runs the unit and integration suites together as
// vitest projects so a single `--coverage` run measures the true combined
// coverage. The standalone vitest.config.ts / vitest.config.integration.ts
// remain the fast per-suite dev configs; this one exists so CI can enforce
// coverage thresholds across both suites. e2e is intentionally excluded.
export default defineConfig({
    test: {
        coverage: {
            enabled: true,
            provider: 'v8',
            // Do not rmdir reportsDirectory on start: in CI ./coverage is a
            // bind-mount (see compose.ci.yml) and rmdir of a mount point is
            // EBUSY. The report files are simply overwritten each run.
            clean: false,
            reporter: ['text', 'text-summary', 'json', 'cobertura'],
            include: ['src/**/*.ts'],
            all: true,
            exclude: ['**/node_modules/**', 'dist/**', '**/types/**'],
            reportsDirectory: './coverage',
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
                resolve: {
                    alias: {'@': resolve(__dirname, 'src')}
                },
                test: {
                    name: 'unit',
                    environment: 'node',
                    include: ['test/unit/**/*.test.ts'],
                    restoreMocks: true,
                    unstubEnvs: true
                }
            },
            {
                resolve: {
                    alias: {'@': resolve(__dirname, 'src')}
                },
                test: {
                    name: 'integration',
                    environment: 'node',
                    include: ['test/integration/**/*.test.ts'],
                    setupFiles: ['test/setup/integration.ts'],
                    restoreMocks: true,
                    unstubEnvs: true,
                    testTimeout: 30000,
                    hookTimeout: 30000,
                    // Integration tests share the emulators — keep them serial.
                    fileParallelism: false,
                    maxWorkers: 1
                }
            }
        ]
    }
});
