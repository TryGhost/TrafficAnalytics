import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';
import {publishEvent} from '../services/events/publisher.js';
import {PageHitRequestType} from '../schemas';
import {pageHitRawPayloadFromRequest} from '../transformations/page-hit-transformations.js';
import {pageHitRouteOptions} from '../handlers/page-hit-handlers.js';

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

async function proxyPlugin(fastify: FastifyInstance) {
    fastify.post('/tb/web_analytics', pageHitRouteOptions);
    
    // Register local proxy endpoint for development/testing
    fastify.post('/local-proxy*', async () => {
        return 'Hello World - From the local proxy';
    });
}

export default fp(proxyPlugin);