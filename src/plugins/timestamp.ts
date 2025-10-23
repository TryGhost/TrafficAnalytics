import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
    interface FastifyRequest {
        serverReceivedAt: Date;
    }
}

async function timestampPlugin(fastify: FastifyInstance) {
    // Capture timestamp as early as possible in the request lifecycle.
    fastify.addHook('onRequest', async (request) => {
        request.serverReceivedAt = new Date();
    });
}

export default fp(timestampPlugin);
