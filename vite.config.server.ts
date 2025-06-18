import {defineConfig} from 'vite';
import {VitePluginNode} from 'vite-plugin-node';

export default defineConfig({
    server: {
        port: 3000
    },
    build: {
        target: 'esnext',
        outDir: 'dist/server',
        minify: false,
        rollupOptions: {
            output: {
                entryFileNames: '[name].js',
                preserveModules: true,
                exports: 'named',
                format: 'es'
            }
        }
    },
    plugins: [
        ...VitePluginNode({
            adapter: 'fastify',
            appPath: './server.ts',
            exportName: 'default'
        })
    ]
});
