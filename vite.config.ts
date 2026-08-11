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
                inlineDynamicImports: true,
                // Node only defines these in CommonJS, but bundling inlines dependencies
                // that read them at module scope — google-gax builds a proto path from
                // `__dirname` on import and throws without it. They point at `dist/`, not
                // each dependency's own directory, but nothing we run uses those paths.
                banner: [
                    'globalThis.__filename ??= import.meta.filename;',
                    'globalThis.__dirname ??= import.meta.dirname;'
                ].join('\n')
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
