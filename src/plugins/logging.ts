import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';
import {extractTraceContext} from '../utils/logger';

async function loggingPlugin(fastify: FastifyInstance) {
    fastify.addHook('onRequest', async (request) => {
        // Extract trace context for GCP log correlation
        const traceContext = extractTraceContext(request);
        if (Object.keys(traceContext).length > 0) {
            request.log = request.log.child(traceContext);
        }

        // Construct full URL to match GCP request logs
        const fullUrl = `${request.protocol}://${request.hostname}${request.url}`;
        
        request.log.info({
            httpRequest: {
                requestMethod: request.method,
                requestUrl: fullUrl,
                userAgent: request.headers['user-agent'],
                remoteIp: request.ip,
                referer: request.headers.referer,
                protocol: `${request.protocol.toUpperCase()}/${request.raw.httpVersion}`,
                requestSize: String(request.raw.headers['content-length'] || 0)
            }
        }, 'incoming request');
    });

    fastify.addHook('onResponse', async (request, reply) => {
        // Construct full URL to match GCP request logs
        const fullUrl = `${request.protocol}://${request.hostname}${request.url}`;
        
        request.log.info({
            httpRequest: {
                requestMethod: request.method,
                requestUrl: fullUrl,
                userAgent: request.headers['user-agent'],
                remoteIp: request.ip,
                referer: request.headers.referer,
                protocol: `${request.protocol.toUpperCase()}/${request.raw.httpVersion}`,
                requestSize: String(request.raw.headers['content-length'] || 0),
                responseSize: String(reply.getHeader('content-length') || 0),
                status: reply.statusCode,
                latency: `${(reply.elapsedTime / 1000).toFixed(9)}s`
            }
        }, 'request completed');
    });
}

// Wrapping in `fp` makes these hooks global, so they apply to all routes
// Without this, these hooks would only apply to routes registered in the same plugin
export default fp(loggingPlugin);