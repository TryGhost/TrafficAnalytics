import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';
import {extractTraceContext} from '../utils/logger';
import {getSerializedSizeBytes, summarizeRequestBody} from '../utils/body-summary';

const REQUEST_BODY_LOG_THRESHOLD_BYTES = 3 * 1024;

const getContentLength = (contentLengthHeader: string | string[] | undefined): number | undefined => {
    if (!contentLengthHeader) {
        return undefined;
    }

    const contentLength = Array.isArray(contentLengthHeader) ? contentLengthHeader[0] : contentLengthHeader;
    const parsedLength = Number.parseInt(contentLength, 10);

    return Number.isNaN(parsedLength) ? undefined : parsedLength;
};

async function loggingPlugin(fastify: FastifyInstance) {
    fastify.addHook('onRequest', async (request) => {
        // Extract trace context for GCP log correlation
        const traceContext = extractTraceContext(request);

        // Extract request ID if present
        const rawRequestId = request.headers['x-request-id'];
        const requestId = Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId;

        const childContext: Record<string, unknown> = {
            ...traceContext,
            ...(requestId && {requestId})
        };

        if (Object.keys(childContext).length > 0) {
            request.log = request.log.child(childContext);
        }

        request.log.info({
            event: 'IncomingRequest',
            httpRequest: {
                requestMethod: request.method,
                requestUrl: request.url,
                userAgent: request.headers['user-agent'],
                remoteIp: request.ip,
                referer: request.headers.referer,
                protocol: `${request.protocol.toUpperCase()}/${request.raw.httpVersion}`,
                requestSize: String(request.raw.headers['content-length'] || 0)
            }
        });
    });

    fastify.addHook('preHandler', async (request) => {
        const contentLength = getContentLength(request.headers['content-length']);
        if (contentLength && contentLength > REQUEST_BODY_LOG_THRESHOLD_BYTES) {
            request.log.debug({
                event: 'IncomingRequestBody',
                requestBodySize: contentLength,
                parsedBodySize: getSerializedSizeBytes(request.body),
                bodySummary: summarizeRequestBody(request.body)
            });
        }
    });

    fastify.addHook('onResponse', async (request, reply) => {
        request.log.info({
            event: 'RequestCompleted',
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
        });
    });
}

// Wrapping in `fp` makes these hooks global, so they apply to all routes
// Without this, these hooks would only apply to routes registered in the same plugin
export default fp(loggingPlugin);
