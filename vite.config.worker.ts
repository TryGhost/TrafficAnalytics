import {defineConfig} from 'vite';

export default defineConfig({
    server: {
        port: 3000
    },
    build: {
        target: 'esnext',
        outDir: 'dist/worker',
        minify: false,
        ssr: true,
        rollupOptions: {
            input: 'worker.ts',
            output: {
                entryFileNames: '[name].js',
                format: 'es'
            },
            external: [
                // External dependencies that should not be bundled
                /^@google-cloud/,
                /^@tryghost/,
                'pino'
            ]
        }
    }
});
