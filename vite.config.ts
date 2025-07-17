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
        sourcemap: true,
        rollupOptions: {
            input: 'server.ts',
            output: {
                entryFileNames: '[name].js',
                format: 'es',
                inlineDynamicImports: true,
                banner: `
import { createRequire } from 'module';
import { fileURLToPath as fileURLToPath$1 } from 'url';
import { dirname as dirname$1 } from 'path';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath$1(import.meta.url);
const __dirname = dirname$1(__filename);
`
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
