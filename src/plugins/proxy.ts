import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';
import fastifyHttpProxy, {FastifyHttpProxyOptions} from '@fastify/http-proxy';
import {processRequest, validateRequest} from '../services/proxy';

async function proxyPlugin(fastify: FastifyInstance) {
    // Register the analytics proxy using fastify-http-proxy with custom hooks
    await fastify.register(fastifyHttpProxy, {
        upstream: process.env.PROXY_TARGET || 'http://localhost:3000/local-proxy',
        prefix: '/tb/web_analytics',
        rewritePrefix: '', // Remove the prefix when forwarding
        httpMethods: ['GET', 'POST', 'PUT', 'DELETE'],
        preValidation: validateRequest as FastifyHttpProxyOptions['preValidation'],
        preHandler: processRequest as FastifyHttpProxyOptions['preHandler'],
        replyOptions: {
            onError: (reply, error) => {
                // Log proxy errors with proper structure for GCP
                const unwrappedError = 'error' in error ? error.error : error;
                reply.log.error({
                    err: {
                        message: unwrappedError.message,
                        stack: unwrappedError.stack,
                        name: unwrappedError.name
                    },
                    httpRequest: {
                        requestMethod: reply.request.method,
                        requestUrl: reply.request.url,
                        userAgent: reply.request.headers['user-agent'],
                        remoteIp: reply.request.ip,
                        referer: reply.request.headers.referer,
                        protocol: `${reply.request.protocol.toUpperCase()}/${reply.request.raw.httpVersion}`,
                        status: 502
                    },
                    upstream: process.env.PROXY_TARGET || 'http://localhost:3000/local-proxy',
                    type: 'proxy_error'
                }, 'Proxy error occurred');
                reply.status(502).send({error: 'Proxy error'});
            }
        },
        disableRequestLogging: process.env.LOG_PROXY_REQUESTS === 'false'
    });
    
    // Register local proxy endpoint for development/testing
    fastify.post('/local-proxy*', async () => {
        return 'Hello World - From the local proxy';
    });
}

export default fp(proxyPlugin);