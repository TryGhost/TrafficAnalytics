import {FastifyInstance} from 'fastify';
import {pageHitRequestHandler} from '../../handlers/page-hit-handlers.js';
import {PageHitRequestQueryParamsSchema, PageHitRequestHeadersSchema, PageHitRequestBodySchema, populateAndTransformPageHitRequest} from '../../schemas';

const pageHitRouteOptions = {
    schema: {
        querystring: PageHitRequestQueryParamsSchema,
        headers: PageHitRequestHeadersSchema,
        body: PageHitRequestBodySchema
    },
    preHandler: populateAndTransformPageHitRequest,
    handler: pageHitRequestHandler
};

async function pageHitRoutes(fastify: FastifyInstance) {
    fastify.post('/', pageHitRouteOptions);
}

export default pageHitRoutes;