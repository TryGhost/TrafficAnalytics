import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';
import {pageHitRouteOptions} from '../handlers/page-hit-handlers.js';

async function proxyPlugin(fastify: FastifyInstance) {
    fastify.post('/tb/web_analytics', pageHitRouteOptions);
    
    // Register local proxy endpoint for development/testing
    fastify.post('/local-proxy*', async () => {
        return 'Hello World - From the local proxy';
    });
}

export default fp(proxyPlugin);