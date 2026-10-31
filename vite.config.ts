import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {defineConfig} from 'vite';

const require = createRequire(import.meta.url);

export default defineConfig({
    server: {
        port: 3000
    },
    resolve: {
        alias: [
            // Anchored so only the package index is swapped for the shim; the deep
            // `@google-cloud/logging/build/src/...` import still hits the real package.
            {
                find: /^@google-cloud\/logging$/,
                replacement: resolve(import.meta.dirname, 'src/utils/gcp-logging-shim.ts')
            },
            // The ESM build uses a runtime __require('forwarded-parse') that escapes
            // Vite's bundle. Use the CommonJS entry so the dependency is bundled.
            {
                find: /^@opentelemetry\/instrumentation-http$/,
                replacement: require.resolve('@opentelemetry/instrumentation-http')
            }
        ]
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
