import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';

async function proxyPlugin(fastify: FastifyInstance) {
    // Register local proxy endpoint for development/testing
    fastify.post('/local-proxy*', async () => {
        return 'Hello World - From the local proxy';
    });
}

export default fp(proxyPlugin);