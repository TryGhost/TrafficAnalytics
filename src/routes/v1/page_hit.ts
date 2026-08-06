import {FastifyInstance} from 'fastify';
import {pageHitRouteOptions} from '../../handlers/page-hit-handlers';
import botDetectionPlugin from '../../plugins/bot-detection';

async function pageHitRoutes(fastify: FastifyInstance) {
    fastify.register(botDetectionPlugin);
    fastify.post('/', pageHitRouteOptions);
}

export default pageHitRoutes;