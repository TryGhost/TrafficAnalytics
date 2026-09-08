import bearerAuthPlugin from '@fastify/bearer-auth';
import type {FastifyInstance} from 'fastify';

async function tinybirdSyncRoutes(fastify: FastifyInstance) {
    const auth = process.env.TINYBIRD_SYNC_AUTH;

    await fastify.register(bearerAuthPlugin, {
        keys: new Set(auth ? [auth] : [])
    });

    fastify.post('/', async (_request, reply) => {
        return reply.status(202).send();
    });
}

export default tinybirdSyncRoutes;
