import {FastifyInstance} from 'fastify';
import {pageHitRouteOptions} from '../../handlers/page-hit-handlers';

async function pageHitRoutes(fastify: FastifyInstance) {
    fastify.post('/', pageHitRouteOptions);
}

export default pageHitRoutes;