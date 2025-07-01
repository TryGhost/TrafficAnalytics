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

        request.log.info({
            httpRequest: {
                requestMethod: request.method,
                requestUrl: request.url,
                remoteIp: request.ip
            }
        }, 'incoming request');
    });

    fastify.addHook('onResponse', async (request, reply) => {
        request.log.info({
            httpRequest: {
                requestMethod: request.method,
                requestUrl: request.url,
                remoteIp: request.ip,
                status: reply.statusCode,
                latency: `${(reply.elapsedTime / 1000).toFixed(3)}s`
            }
        }, 'request completed');
    });
}

// Wrapping in `fp` makes these hooks global, so they apply to all routes
// Without this, these hooks would only apply to routes registered in the same plugin
export default fp(loggingPlugin);