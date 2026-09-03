import {FastifyInstance} from 'fastify';
import {automationRouteOptions} from '../../handlers/automation-handlers';

async function automationsRoutes(fastify: FastifyInstance) {
    fastify.addContentTypeParser('application/x-ndjson', {parseAs: 'string'}, (_request, body, done) => {
        done(null, body);
    });

    fastify.post('/', automationRouteOptions);
}

export default automationsRoutes;
