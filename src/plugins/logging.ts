import {FastifyInstance, FastifyRequest} from 'fastify';
import fp from 'fastify-plugin';
import {Transform} from 'node:stream';
import {extractTraceContext} from '../utils/logger';

const REQUEST_BODY_LOG_THRESHOLD_BYTES = 3 * 1024;

const getContentLength = (contentLengthHeader: string | string[] | undefined): number | undefined => {
    if (!contentLengthHeader) {
        return undefined;
    }

    const contentLength = Array.isArray(contentLengthHeader) ? contentLengthHeader[0] : contentLengthHeader;
    const parsedLength = Number.parseInt(contentLength, 10);

    return Number.isNaN(parsedLength) ? undefined : parsedLength;
};

interface RequestWithMeasuredBody extends FastifyRequest {
    measuredRawBodyBytes?: number;
    isDebugLoggingEnabled?: boolean;
}

const isDebugLevelEnabled = (request: FastifyRequest): boolean => {
    const logger = request.log as {levelVal?: number; levels?: {values?: {debug?: number}}};
    const debugLevel = logger.levels?.values?.debug;

    return debugLevel !== undefined && logger.levelVal !== undefined && logger.levelVal <= debugLevel;
};

async function loggingPlugin(fastify: FastifyInstance) {
    fastify.addHook('onRequest', async (request) => {
        const measuredRequest = request as RequestWithMeasuredBody;
        measuredRequest.isDebugLoggingEnabled = isDebugLevelEnabled(request);

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
            },
            contentLengthHeader: request.headers['content-length']
        });
    });

    fastify.addHook('preParsing', async (request, _reply, payload) => {
        const measuredRequest = request as RequestWithMeasuredBody;
        if (!measuredRequest.isDebugLoggingEnabled) {
            return payload;
        }

        measuredRequest.measuredRawBodyBytes = 0;

        const countingStream = new Transform({
            transform(chunk, _encoding, callback) {
                const chunkSize = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk));
                measuredRequest.measuredRawBodyBytes = (measuredRequest.measuredRawBodyBytes ?? 0) + chunkSize;
                callback(null, chunk);
            }
        });

        payload.pipe(countingStream);
        return countingStream;
    });

    fastify.addHook('preValidation', async (request) => {
        const measuredRequest = request as RequestWithMeasuredBody;
        if (measuredRequest.isDebugLoggingEnabled) {
            const declaredContentLength = getContentLength(request.headers['content-length']);
            const measuredRawBodyBytes = measuredRequest.measuredRawBodyBytes;
            const requestBodySizeCandidates = [declaredContentLength, measuredRawBodyBytes]
                .filter((value): value is number => value !== undefined);
            const requestBodySize = requestBodySizeCandidates.length > 0
                ? Math.max(...requestBodySizeCandidates)
                : undefined;
            const logFields: Record<string, unknown> = {
                event: 'IncomingRequestParsed',
                declaredContentLength: declaredContentLength ?? null,
                measuredRawBodyBytes: measuredRawBodyBytes ?? null
            };

            if (requestBodySize !== undefined && requestBodySize > REQUEST_BODY_LOG_THRESHOLD_BYTES) {
                logFields.requestBodySize = requestBodySize;
                logFields.body = request.body;
            }

            request.log.debug(logFields);
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
