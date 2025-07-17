import {defineConfig} from 'vite';

export default defineConfig({
    server: {
        port: 3000
    },
    build: {
        target: 'es2015',
        outDir: 'dist',
        minify: false,
        ssr: true,
        sourcemap: true,
        rollupOptions: {
            input: 'server.ts',
            output: {
                entryFileNames: '[name].js',
                format: 'es'
            },
            external: []
        }
    }
});
