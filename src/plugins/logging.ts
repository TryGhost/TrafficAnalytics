import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';

async function loggingPlugin(fastify: FastifyInstance) {
    fastify.addHook('onRequest', async (request) => {
        const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
        const traceHeader = request.headers['x-cloud-trace-context'] as string;
        if (traceHeader && PROJECT_ID) {
            const traceId = traceHeader.split('/')[0];
            const traceContext = {
                'logging.googleapis.com/trace': `projects/${PROJECT_ID}/traces/${traceId}`
            };

            request.log = request.log.child(traceContext);
        }

        request.log.info({
            httpRequest: {
                requestMethod: request.method,
                requestUrl: request.url,
                userAgent: request.headers['user-agent'],
                remoteIp: request.ip,
                referer: request.headers.referer,
                protocol: `${request.protocol.toUpperCase()}/${request.raw.httpVersion}`,
                requestSize: String(request.raw.headers['content-length'] || 0)
            }
        }, 'incoming request');
    });

    fastify.addHook('onResponse', async (request, reply) => {
        request.log.info({
            httpRequest: {
                requestMethod: request.method,
                requestUrl: request.url,
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

export default fp(loggingPlugin);