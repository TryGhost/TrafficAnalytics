import {FastifyInstance} from 'fastify';

async function v1Routes(fastify: FastifyInstance) {
    await fastify.register(import('./page_hit'), {prefix: '/page_hit'});
}

export default v1Routes;