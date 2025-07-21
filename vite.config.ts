import {defineConfig} from 'vite';

export default defineConfig({
    server: {
        port: 3000
    },
    build: {
        target: 'esnext',
        outDir: 'dist',
        minify: true,
        ssr: true,
        sourcemap: true,
        rollupOptions: {
            input: 'server.ts',
            output: {
                entryFileNames: '[name].js',
                format: 'es',
                inlineDynamicImports: true
            },
            external: () => {
                return false;
            }
        }
    },
    ssr: {
        noExternal: true
    }
});
