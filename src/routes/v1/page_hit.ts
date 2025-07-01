import {FastifyInstance} from 'fastify';

async function pageHitRoutes(fastify: FastifyInstance) {
    fastify.get('/', async (request, reply) => {
        return reply.status(200).send('Hello World');
    });
}

export default pageHitRoutes;