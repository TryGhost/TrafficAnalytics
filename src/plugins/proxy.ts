import {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import fp from 'fastify-plugin';
import replyFrom from '@fastify/reply-from';
import {processRequest} from '../services/proxy';
import {QueryParamsSchema, HeadersSchema, BodySchema, PageHitRequest} from '../schemas';

async function proxyPlugin(fastify: FastifyInstance) {
    // Register reply-from for proxying capabilities
    await fastify.register(replyFrom);

    // Register the analytics proxy with native schema validation
    fastify.post('/tb/web_analytics', {
        schema: {
            querystring: QueryParamsSchema,
            headers: HeadersSchema,
            body: BodySchema
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            await processRequest(request as PageHitRequest, reply);

            // Proxy the request to the upstream target
            const upstream = process.env.PROXY_TARGET || 'http://localhost:3000/local-proxy';
            await reply.from(upstream, {
                onError: (replyInstance, error) => {
                    // Log proxy errors with proper structure for GCP
                    const unwrappedError = 'error' in error ? error.error : error;
                    replyInstance.log.error({
                        err: {
                            message: unwrappedError.message,
                            stack: unwrappedError.stack,
                            name: unwrappedError.name
                        },
                        httpRequest: {
                            requestMethod: replyInstance.request.method,
                            requestUrl: replyInstance.request.url,
                            userAgent: replyInstance.request.headers['user-agent'],
                            remoteIp: replyInstance.request.ip,
                            referer: replyInstance.request.headers.referer,
                            protocol: `${replyInstance.request.protocol.toUpperCase()}/${replyInstance.request.raw.httpVersion}`,
                            status: 502
                        },
                        upstream: upstream,
                        type: 'proxy_error'
                    }, 'Proxy error occurred');
                    replyInstance.status(502).send({error: 'Proxy error'});
                }
            });
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
    });
    
    // Register local proxy endpoint for development/testing
    fastify.post('/local-proxy*', async () => {
        return 'Hello World - From the local proxy';
    });
}

export default fp(proxyPlugin);