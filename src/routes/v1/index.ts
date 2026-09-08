import {FastifyInstance} from 'fastify';

async function v1Routes(fastify: FastifyInstance) {
    await fastify.register(import('./page_hit'), {prefix: '/page_hit'});
    await fastify.register(import('./tinybird-sync'), {prefix: '/tinybird-sync'});
}

export default v1Routes;
