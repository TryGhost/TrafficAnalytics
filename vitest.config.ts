import {defineConfig} from 'vitest/config';
import {resolve} from 'path';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['test/**/*.test.ts'],
        coverage: {
            enabled: true,
            provider: 'v8',
            reporter: ['text', 'json'],
            include: ['src/**/*.ts'],
            all: true,
            exclude: ['**/node_modules/**', 'dist/**', '**/types/**'],
            reportsDirectory: './coverage'
        }
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src')
        }
    }
});
