import {FastifyInstance, FastifyReply as FastifyReplyBase} from 'fastify';
import fp from 'fastify-plugin';
import {processRequest} from '../services/proxy';
import {FastifyRequest, FastifyReply} from '../types';
import {AnalyticsRouteSchema, ValidatedAnalyticsRequest} from '../schemas/v1/page-hit-raw-request';

async function proxyPlugin(fastify: FastifyInstance) {
    await fastify.register(import('@fastify/reply-from'), {
        disableRequestLogging: process.env.LOG_PROXY_REQUESTS === 'false'
    });

    // Main analytics proxy route
    fastify.post('/tb/web_analytics', {
        schema: AnalyticsRouteSchema,
        preHandler: async (request: ValidatedAnalyticsRequest, reply: FastifyReplyBase) => {
            await processRequest(request as FastifyRequest, reply as FastifyReply);
        }
    }, async (request, reply) => {
        try {
            const targetUrl = process.env.PROXY_TARGET || 'http://localhost:3000/local-proxy';
            const url = new URL(request.url, 'http://localhost');
            await reply.from(targetUrl + url.search);
        } catch (error) {
            // Log proxy errors and let Fastify handle the response
            request.log.error({
                error: error instanceof Error ? error.message : String(error),
                targetUrl: process.env.PROXY_TARGET || 'http://localhost:3000/local-proxy',
                url: request.url
            }, 'Proxy forwarding failed');
            throw error; // Re-throw to let Fastify handle the error response
        }
    });
    
    // Local proxy endpoint for development/testing
    fastify.post('/local-proxy', async () => {
        return 'Hello World - From the local proxy';
    });
}

export default fp(proxyPlugin);