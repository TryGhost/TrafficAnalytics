import {FastifyInstance, FastifyReply} from 'fastify';
import fp from 'fastify-plugin';
import replyFrom from '@fastify/reply-from';
import {publishEvent} from '../services/events/publisher.js';
import {PageHitRequestType, PageHitRaw, PageHitRequestQueryParamsSchema, PageHitRequestHeadersSchema, PageHitRequestBodySchema, populateAndTransformPageHitRequest, transformPageHitRawToProcessed} from '../schemas';
import type {PageHitRequestQueryParamsType, PageHitRequestHeadersType, PageHitRequestBodyType} from '../schemas';
import {randomUUID} from 'crypto';
const pageHitRawPayloadFromRequest = (request: PageHitRequestType): PageHitRaw => {
    return {
        timestamp: request.body.timestamp,
        action: request.body.action,
        version: request.body.version,
        site_uuid: request.headers['x-site-uuid'],
        payload: {
            event_id: request.body.payload.event_id ?? randomUUID(),
            member_uuid: request.body.payload.member_uuid,
            member_status: request.body.payload.member_status,
            post_uuid: request.body.payload.post_uuid,
            post_type: request.body.payload.post_type,
            locale: request.body.payload.locale,
            location: request.body.payload.location,
            referrer: request.body.payload.referrer ?? null,
            parsedReferrer: request.body.payload.parsedReferrer,
            pathname: request.body.payload.pathname,
            href: request.body.payload.href
        },
        meta: {
            ip: request.ip,
            'user-agent': request.headers['user-agent']
        }
    };
};

const publishPageHitRaw = async (request: PageHitRequestType): Promise<void> => {
    const topic = process.env.PUBSUB_TOPIC_PAGE_HITS_RAW as string;
    if (topic) {
        const payload = pageHitRawPayloadFromRequest(request);
        request.log.info({payload}, 'Publishing page hit raw event');
        await publishEvent({
            topic,
            payload,
            logger: request.log
        });
    }    
};

const handlePageHitRequestStrategyBatch = async (request: PageHitRequestType): Promise<void> => {
    try {
        await publishPageHitRaw(request);
    } catch (error) {
        request.log.error({error: error instanceof Error ? error.message : String(error)}, 'Failed to publish page hit event - continuing with request');
    }
};

const handlePageHitRequestStrategyInline = async (request: PageHitRequestType, reply: FastifyReply): Promise<void> => {
    const pageHitRaw = pageHitRawPayloadFromRequest(request);
    const pageHitProcessed = await transformPageHitRawToProcessed(pageHitRaw);
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
};

async function proxyPlugin(fastify: FastifyInstance) {
    // Register reply-from for proxying capabilities
    await fastify.register(replyFrom);

    // Register the analytics proxy with native schema validation
    fastify.post<{
        Querystring: PageHitRequestQueryParamsType,
        Headers: PageHitRequestHeadersType,
        Body: PageHitRequestBodyType
    }>('/tb/web_analytics', {
        schema: {
            querystring: PageHitRequestQueryParamsSchema,
            headers: PageHitRequestHeadersSchema,
            body: PageHitRequestBodySchema
        },
        preHandler: populateAndTransformPageHitRequest
    }, async (request, reply) => {
        try {
            // Publish raw page hit event to Pub/Sub BEFORE any processing (if topic is configured)
            // This is fire-and-forget - don't let Pub/Sub errors break the proxy
            await handlePageHitRequestStrategyBatch(request);
            await handlePageHitRequestStrategyInline(request, reply);
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