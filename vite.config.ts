import {defineConfig} from 'vite';

export default defineConfig({
    server: {
        port: 3000
    },
    build: {
        target: 'esnext',
        outDir: 'dist',
        minify: false,
        ssr: true,
        rollupOptions: {
            input: 'server.ts',
            output: {
                entryFileNames: '[name].js',
                format: 'es'
            },
            external: [
                // External dependencies that should not be bundled
                /^@fastify/,
                /^@google-cloud/,
                /^@tryghost/,
                /^@opentelemetry/,
                'fastify',
                'fastify-plugin',
                'pino',
                'ua-parser-js'
            ]
        }
    }
});