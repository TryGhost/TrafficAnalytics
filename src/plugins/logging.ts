import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';
import {PassThrough} from 'node:stream';
import {extractTraceContext} from '../utils/trace-context';

const METHODS_WITH_REQUEST_BODY = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

type RequestBodyDiagnostics = {
    contentType: string | string[] | undefined;
    contentLength: string | string[] | undefined;
    transferEncoding: string | string[] | undefined;
    rawBytes?: number;
    rawComplete?: boolean;
    rawAborted?: boolean;
};

declare module 'fastify' {
    interface FastifyRequest {
        requestBodyDiagnostics: RequestBodyDiagnostics | null;
    }
}

async function loggingPlugin(fastify: FastifyInstance) {
    fastify.decorateRequest('requestBodyDiagnostics', null);

    fastify.addHook('onRequest', async (request) => {
        // Extract trace context for GCP log correlation
        const traceContext = extractTraceContext(request);

        // Extract request ID if present
        const rawRequestId = request.headers['x-request-id'];
        const requestId = Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId;

        // Extract site UUID if present
        const rawSiteUuid = request.headers['x-site-uuid'];
        const siteUuid = Array.isArray(rawSiteUuid) ? rawSiteUuid[0] : rawSiteUuid;

        const childContext: Record<string, unknown> = {
            ...traceContext,
            ...(requestId && {requestId}),
            ...(siteUuid && {siteUuid})
        };

        if (Object.keys(childContext).length > 0) {
            request.log = request.log.child(childContext);
        }

        request.requestBodyDiagnostics = {
            contentType: request.headers['content-type'],
            contentLength: request.headers['content-length'],
            transferEncoding: request.headers['transfer-encoding']
        };

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

    fastify.addHook('preParsing', async (request, _reply, payload) => {
        if (!METHODS_WITH_REQUEST_BODY.has(request.method)) {
            return payload;
        }

        let rawBytes = 0;
        const tee = new PassThrough();

        request.requestBodyDiagnostics = request.requestBodyDiagnostics ?? {
            contentType: request.headers['content-type'],
            contentLength: request.headers['content-length'],
            transferEncoding: request.headers['transfer-encoding']
        };

        payload.on('data', (chunk) => {
            rawBytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
        });

        payload.on('end', () => {
            if (!request.requestBodyDiagnostics) {
                return;
            }

            request.requestBodyDiagnostics.rawBytes = rawBytes;
            request.requestBodyDiagnostics.rawComplete = request.raw.complete;
            request.requestBodyDiagnostics.rawAborted = request.raw.aborted;
        });

        payload.pipe(tee);
        return tee;
    });

    fastify.addHook('onResponse', async (request, reply) => {
        request.log.debug({
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
            },
            ...(request.requestBodyDiagnostics && {requestBody: request.requestBodyDiagnostics})
        });
    });
}

// Wrapping in `fp` makes these hooks global, so they apply to all routes
// Without this, these hooks would only apply to routes registered in the same plugin
export default fp(loggingPlugin);
