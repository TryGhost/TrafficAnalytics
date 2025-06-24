import {FastifyInstance, FastifyRequest as FastifyRequestBase, FastifyReply as FastifyReplyBase} from 'fastify';
import {Static} from '@sinclair/typebox';
import fp from 'fastify-plugin';
import {processRequest} from '../services/proxy';
import {FastifyRequest, FastifyReply} from '../types';
import {QueryParamsSchema, HeadersSchema, BodySchema} from '../schemas/v1/page-hit-raw-request';

async function proxyPlugin(fastify: FastifyInstance) {
    await fastify.register(import('@fastify/reply-from'), {
        disableRequestLogging: process.env.LOG_PROXY_REQUESTS === 'false'
    });

    const handleProxyError = (request: FastifyRequest, reply: FastifyReply, error: unknown) => {
        const unwrappedError = error && typeof error === 'object' && 'error' in error ? (error as {error: Error}).error : error as Error;
        reply.log.error({
            err: {
                message: unwrappedError.message,
                stack: unwrappedError.stack,
                name: unwrappedError.name
            },
            httpRequest: {
                requestMethod: request.method,
                requestUrl: request.url,
                userAgent: request.headers['user-agent'],
                remoteIp: request.ip,
                referer: request.headers.referer,
                protocol: `${request.protocol.toUpperCase()}/${request.raw.httpVersion}`,
                status: 502
            },
            upstream: process.env.PROXY_TARGET || 'http://localhost:3000/local-proxy',
            type: 'proxy_error'
        }, 'Proxy error occurred');
        reply.status(502).send({error: 'Proxy error'});
    };

    const typedProcessRequest = async (
        request: FastifyRequestBase<{
            Querystring: Static<typeof QueryParamsSchema>;
            Headers: Static<typeof HeadersSchema>;
            Body: Static<typeof BodySchema>;
        }>,
        reply: FastifyReplyBase
    ) => {
        await processRequest(request as FastifyRequest, reply as FastifyReply);
    };

    fastify.post('/tb/web_analytics', {
        schema: {
            querystring: QueryParamsSchema,
            headers: HeadersSchema,
            body: BodySchema
        },
        preHandler: typedProcessRequest
    }, async (request, reply) => {
        try {
            // Forward directly to the PROXY_TARGET with query params
            const targetUrl = process.env.PROXY_TARGET || 'http://localhost:3000/local-proxy';
            const url = new URL(request.url, 'http://localhost');
            const fullTargetUrl = targetUrl + url.search;
            await reply.from(fullTargetUrl);
        } catch (error) {
            handleProxyError(request as FastifyRequest, reply as FastifyReply, error);
        }
    });
    
    // Default local proxy endpoint for development/testing
    fastify.post('/local-proxy', async () => {
        return 'Hello World - From the local proxy';
    });
}

export default fp(proxyPlugin);