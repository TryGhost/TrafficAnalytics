import {FastifyReply, FastifyRequest} from 'fastify';
import {PageHitRequestBodySchema, PageHitRequestHeadersSchema, PageHitRequestQueryParamsSchema, PageHitRequestType, populateAndTransformPageHitRequest, transformPageHitRawToProcessed, type PageHitRequestBodyType, type PageHitRequestHeadersType, type PageHitRequestQueryParamsType} from '../schemas';
import {publishPageHitRaw} from '../services/events/publisherUtils';
import {pageHitRawPayloadFromRequest} from '../transformations/page-hit-transformations';

export const handlePageHitRequestStrategyBatch = async (request: PageHitRequestType, reply: FastifyReply): Promise<void> => {
    const payload = pageHitRawPayloadFromRequest(request);
    try {
        await publishPageHitRaw(request, payload);
        reply.status(202).send({message: 'Page hit event received'});
    } catch (error) {
        request.log.error({
            event: 'PageHitPublishFailed',
            error: error instanceof Error ? {
                message: error.message,
                stack: error.stack,
                name: error.name
            } : error,
            payload,
            httpRequest: {
                requestMethod: request.method,
                requestUrl: request.url,
                userAgent: request.headers['user-agent'],
                remoteIp: request.ip,
                referer: request.headers.referer,
                protocol: `${request.protocol.toUpperCase()}/${request.raw.httpVersion}`,
                status: 500
            },
            type: 'batch_processing_error'
        });
        reply.status(500).send({error: 'Failed to process page hit event'});
    }
};

export const handlePageHitRequestStrategyInline = async (request: PageHitRequestType, reply: FastifyReply): Promise<void> => {
    const pageHitRaw = pageHitRawPayloadFromRequest(request);
    const pageHitProcessed = await transformPageHitRawToProcessed(pageHitRaw);

    // Filter bot traffic before proxying
    if (pageHitProcessed.payload.device === 'bot') {
        request.log.info({
            event: 'BotEventFiltered',
            pageHitProcessed
        });
        reply.status(202).send();
        return;
    }

    request.body = pageHitProcessed;

    // Proxy the request to the upstream target
    const upstream = process.env.PROXY_TARGET || 'http://localhost:3000/local-proxy';
    await reply.from(upstream, {
        queryString: (_search, _reqUrl, req) => {
            // Rewrite the query parameters
            const params = new URLSearchParams(req.query as Record<string, string>);
            if (process.env.TINYBIRD_TRACKER_TOKEN && params.has('token')) {
                // Remove token from query string when using env var
                params.delete('token');
            }
            if (process.env.TINYBIRD_WAIT === 'true') {
                params.set('wait', 'true');
            }
            return params.toString();
        },
        rewriteRequestHeaders: (req, headers) => {
            // Add authorization header when using env var token
            if (process.env.TINYBIRD_TRACKER_TOKEN) {
                return {
                    ...headers,
                    authorization: `Bearer ${process.env.TINYBIRD_TRACKER_TOKEN}`
                };
            }
            return headers;
        },
        onError: (replyInstance, error) => {
            // Log proxy errors with proper structure for GCP
            const unwrappedError = 'error' in error ? error.error : error;
            replyInstance.log.error({
                event: 'ProxyError',
                error: {
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
                upstream,
                type: 'proxy_error'
            });
            replyInstance.status(502).send({error: 'Proxy error'});
        }
    });
};

export const pageHitRequestHandler = async (request: FastifyRequest<{
    Querystring: PageHitRequestQueryParamsType;
    Headers: PageHitRequestHeadersType;
    Body: PageHitRequestBodyType;
}>, reply: FastifyReply) => {
    try {
        // If pub/sub topic is set, publish to topic and return 202. Else, proxy to target server
        if (process.env.PUBSUB_TOPIC_PAGE_HITS_RAW) {
            await handlePageHitRequestStrategyBatch(request, reply);
        } else {
            await handlePageHitRequestStrategyInline(request, reply);
        }
    } catch (error) {
        reply.log.error({
            event: 'RequestProcessingError',
            error: error instanceof Error ? {
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
        });
        reply.status(500).send({error: 'Internal server error'});
    }
};

export const pageHitRouteOptions = {
    schema: {
        querystring: PageHitRequestQueryParamsSchema,
        headers: PageHitRequestHeadersSchema,
        body: PageHitRequestBodySchema
    },
    preHandler: populateAndTransformPageHitRequest,
    handler: pageHitRequestHandler
};
