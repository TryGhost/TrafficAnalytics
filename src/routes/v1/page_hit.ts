import {FastifyInstance, FastifyPluginOptions} from 'fastify';

async function pageHitRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
    fastify.get('/', async (request, reply) => {
        return reply.status(200).send('Hello World');
    });
}

export default pageHitRoutes;