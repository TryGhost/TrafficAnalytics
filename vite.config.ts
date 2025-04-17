import { defineConfig } from 'vite';
import { VitePluginNode } from 'vite-plugin-node';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 3000
  },
  build: {
    outDir: 'dist',
    minify: false,
    lib: {
      entry: {
        'server': resolve(__dirname, 'server.ts'),
        'src/app': resolve(__dirname, 'src/app.ts'),
        'src/utils/query-params': resolve(__dirname, 'src/utils/query-params.ts'),
        'src/services/proxy/index': resolve(__dirname, 'src/services/proxy/index.ts'),
        'src/services/proxy/proxy': resolve(__dirname, 'src/services/proxy/proxy.ts'),
        'src/services/proxy/processors': resolve(__dirname, 'src/services/proxy/processors.ts'),
        'src/services/proxy/validators': resolve(__dirname, 'src/services/proxy/validators.ts'),
      },
      formats: ['cjs'],
    },
    rollupOptions: {
      external: ['fastify', '@fastify/cors', '@fastify/http-proxy', 'dotenv', 'ua-parser-js', '@tryghost/errors'],
      output: {
        entryFileNames: '[name].js',
        preserveModules: true,
        exports: 'named'
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