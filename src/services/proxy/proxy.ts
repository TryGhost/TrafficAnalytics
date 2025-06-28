import {FastifyRequest, FastifyReply} from '../../types';
import {handleSiteUUIDHeader} from './processors/handle-site-uuid-header';
import {parseReferrer} from './processors/url-referrer';
import {parseUserAgent} from './processors/parse-user-agent';
import {generateUserSignature} from './processors/user-signature';
import {publishEvent} from '../events/publisher.js';
import {TypeCompiler} from '@sinclair/typebox/compiler';
import {QueryParamsSchema, HeadersSchema, BodySchema, PageHitRaw, PageHitRequest} from '../../schemas';
import {randomUUID} from 'crypto';
import validator from '@tryghost/validator';

// Compile schema validators once for performance
const queryValidator = TypeCompiler.Compile(QueryParamsSchema);
const headersValidator = TypeCompiler.Compile(HeadersSchema);
const bodyValidator = TypeCompiler.Compile(BodySchema);

/**
 * Validates an event_id and returns a valid UUID.
 * If the provided event_id is a valid UUID, returns it unchanged.
 * Otherwise, generates a new random UUID.
 */
export const ensureValidEventId = (eventId?: string): string => {
    if (eventId && validator.isUUID(eventId)) {
        return eventId;
    }
    return randomUUID();
};

const pageHitRawPayloadFromRequest = (request: PageHitRequest): PageHitRaw => {
    return {
        timestamp: request.body.timestamp,
        action: request.body.action,
        version: request.body.version,
        site_uuid: request.headers['x-site-uuid'],
        payload: {
            event_id: ensureValidEventId(request.body.payload.event_id),
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

const publishPageHitRaw = async (request: PageHitRequest): Promise<void> => {
    try {
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
    } catch (error) {
        request.log.error({
            error: error instanceof Error ? error.message : String(error),
            topic: process.env.PUBSUB_TOPIC_PAGE_HITS_RAW as string
        }, 'Failed to publish page hit event - continuing with request');
    };
};

// Accepts a request object
// Does some processing — user agent parsing, geoip lookup, etc.
// Modifies the request object in place
// Called within the HTTP proxy route
// Eventually will be called on each request pulled from the queue
export async function processRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const validatedRequest = request as PageHitRequest;
    validatedRequest.body.payload.event_id = ensureValidEventId(validatedRequest.body.payload.event_id);
    handleSiteUUIDHeader(request);

    try {
        // Publish raw page hit event to Pub/Sub BEFORE any processing (if topic is configured)
        // This is fire-and-forget - don't let Pub/Sub errors break the proxy
        await publishPageHitRaw(validatedRequest);

        parseUserAgent(validatedRequest);
        parseReferrer(validatedRequest);
        await generateUserSignature(validatedRequest);
    } catch (error) {
        reply.code(500).send(error);
        throw error; // Re-throw to let Fastify handle it
    }
}
