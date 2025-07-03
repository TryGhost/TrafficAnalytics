import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';
import {publishEvent} from '../services/events/publisher.js';
import {PageHitRequestType, PageHitRequestQueryParamsSchema, PageHitRequestHeadersSchema, PageHitRequestBodySchema, populateAndTransformPageHitRequest} from '../schemas';
import {pageHitRawPayloadFromRequest} from '../transformations/page-hit-transformations.js';
import {pageHitRequestHandler} from '../handlers/page-hit-handlers.js';

export const publishPageHitRaw = async (request: PageHitRequestType): Promise<void> => {
    const topic = process.env.PUBSUB_TOPIC_PAGE_HITS_RAW as string;
    if (topic) {
        const payload = pageHitRawPayloadFromRequest(request);
        request.log.info({payload}, 'Publishing page hit raw event');
        await publishEvent({
            topic,
            payload,
            logger: request.log
        });
    }    
};

const pageHitRouteOptions = {
    schema: {
        querystring: PageHitRequestQueryParamsSchema,
        headers: PageHitRequestHeadersSchema,
        body: PageHitRequestBodySchema
    },
    preHandler: populateAndTransformPageHitRequest,
    handler: pageHitRequestHandler
};

async function proxyPlugin(fastify: FastifyInstance) {
    fastify.post('/tb/web_analytics', pageHitRouteOptions);
    
    // Register local proxy endpoint for development/testing
    fastify.post('/local-proxy*', async () => {
        return 'Hello World - From the local proxy';
    });
}

export default fp(proxyPlugin);