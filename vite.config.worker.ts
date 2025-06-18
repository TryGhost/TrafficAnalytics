import {defineConfig} from 'vite';
import {resolve} from 'path';

export default defineConfig({
    server: {
        port: 3000
    },
    build: {
        target: 'esnext',
        outDir: 'dist/worker',
        minify: false,
        lib: {
            entry: resolve(__dirname, 'worker.ts'),
            formats: ['es']
        },
        rollupOptions: {
            output: {
                entryFileNames: '[name].js',
                preserveModules: true,
                exports: 'named',
                format: 'es'
            }
        }
    }
});
