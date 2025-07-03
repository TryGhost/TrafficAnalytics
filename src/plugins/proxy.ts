import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import fp from 'fastify-plugin';
import {publishEvent} from '../services/events/publisher.js';
import {PageHitRequestType, PageHitRequestQueryParamsSchema, PageHitRequestHeadersSchema, PageHitRequestBodySchema, populateAndTransformPageHitRequest} from '../schemas';
import type {PageHitRequestQueryParamsType, PageHitRequestHeadersType, PageHitRequestBodyType} from '../schemas';
import {pageHitRawPayloadFromRequest} from '../transformations/page-hit-transformations.js';
import {handlePageHitRequestStrategyBatch, handlePageHitRequestStrategyInline} from '../handlers/page-hit-handlers.js';

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

const pageHitRequestHandler = async (request: FastifyRequest<{
    Querystring: PageHitRequestQueryParamsType,
    Headers: PageHitRequestHeadersType,
    Body: PageHitRequestBodyType
}>, reply: FastifyReply) => {
    try {
        // If pub/sub topic is set, publish to topic and return 202. Else, proxy to target server
        if (process.env.PUBSUB_TOPIC_PAGE_HITS_RAW) {
            await handlePageHitRequestStrategyBatch(request, reply);
        } else {
            await handlePageHitRequestStrategyInline(request, reply);
        }
    } catch (error) {
        reply.log.error({
            err: error instanceof Error ? {
                message: error.message,
                stack: error.stack,
                name: error.name
            } : error,
            httpRequest: {
                requestMethod: request.method,
                requestUrl: request.url,
                userAgent: request.headers['user-agent'],
                remoteIp: request.ip,
                referer: request.headers.referer,
                protocol: `${request.protocol.toUpperCase()}/${request.raw.httpVersion}`,
                status: 500
            },
            type: 'processing_error'
        }, 'Request processing error occurred');
        reply.status(500).send({error: 'Internal server error'});
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
    fastify.post<{
        Querystring: PageHitRequestQueryParamsType,
        Headers: PageHitRequestHeadersType,
        Body: PageHitRequestBodyType
    }>('/tb/web_analytics', pageHitRouteOptions);
    
    // Register local proxy endpoint for development/testing
    fastify.post('/local-proxy*', async () => {
        return 'Hello World - From the local proxy';
    });
}

export default fp(proxyPlugin);