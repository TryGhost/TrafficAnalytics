import {FastifyRequest, FastifyReply} from '../../types';
import {handleSiteUUIDHeader} from './processors/handle-site-uuid-header';
import {parseReferrer} from './processors/url-referrer';
import {parseUserAgent} from './processors/parse-user-agent';
import {generateUserSignature} from './processors/user-signature';
import {publishEvent} from '../events/publisher.js';
import {TypeCompiler} from '@sinclair/typebox/compiler';
import {QueryParamsSchema, HeadersSchema, BodySchema, PageHitRaw} from '../../schemas';
import {Static} from '@sinclair/typebox';
import crypto from 'crypto';

// Compile schema validators once for performance
const queryValidator = TypeCompiler.Compile(QueryParamsSchema);
const headersValidator = TypeCompiler.Compile(HeadersSchema);
const bodyValidator = TypeCompiler.Compile(BodySchema);

interface ValidatedRequest extends FastifyRequest {
    query: Static<typeof QueryParamsSchema>;
    headers: Static<typeof HeadersSchema>;
    body: Static<typeof BodySchema>;
}

const pageHitRawPayloadFromRequest = (request: ValidatedRequest): PageHitRaw => {
    return {
        timestamp: request.body.timestamp,
        action: request.body.action,
        version: request.body.version,
        site_uuid: request.headers['x-site-uuid'],
        event_id: request.body.event_id || crypto.randomUUID(),
        payload: {
            member_uuid: request.body.payload.member_uuid,
            member_status: request.body.payload.member_status,
            post_uuid: request.body.payload.post_uuid,
            post_type: request.body.payload.post_type,
            locale: request.body.payload.locale,
            location: request.body.payload.location,
            referrer: request.body.payload.referrer,
            pathname: request.body.payload.pathname,
            href: request.body.payload.href
        },
        meta: {
            ip: request.ip,
            'user-agent': request.headers['user-agent']
        }
    };
};

const publishPageHitRaw = async (request: ValidatedRequest): Promise<void> => {
    try {
        const topic = process.env.PUBSUB_TOPIC_PAGE_HITS_RAW as string;
        if (topic) {
            const payload = pageHitRawPayloadFromRequest(request);
            request.log.info({payload, event_id: request.body.event_id}, 'Publishing page hit raw event');
            await publishEvent({
                topic,
                payload,
                logger: request.log
            });
        }    
    } catch (error) {
        request.log.error({
            error: error instanceof Error ? error.message : String(error),
            topic: process.env.PUBSUB_TOPIC_PAGE_HITS_RAW as string,
            event_id: request.body.event_id
        }, 'Failed to publish page hit event - continuing with request');
    };
};

// Accepts a request object
// Does some processing — user agent parsing, geoip lookup, etc.
// Modifies the request object in place
// Called within the HTTP proxy route
// Eventually will be called on each request pulled from the queue
export async function processRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const validatedRequest = request as ValidatedRequest;
    
    // Generate event_id at the very beginning of request processing if not provided
    if (!validatedRequest.body.event_id) {
        validatedRequest.body.event_id = crypto.randomUUID();
    }
    
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

export function validateRequestWithSchema(request: FastifyRequest, reply: FastifyReply, done: () => void): void {
    const allErrors: Array<{section: string, path: string, message: string, value: unknown}> = [];

    // Validate query parameters
    if (!queryValidator.Check(request.query)) {
        const queryErrors = [...queryValidator.Errors(request.query)];
        allErrors.push(...queryErrors.map(error => ({
            section: 'query',
            path: error.path,
            message: error.message,
            value: error.value
        })));
    }

    // Validate headers
    if (!headersValidator.Check(request.headers)) {
        const headerErrors = [...headersValidator.Errors(request.headers)];
        allErrors.push(...headerErrors.map(error => ({
            section: 'headers',
            path: error.path,
            message: error.message,
            value: error.value
        })));
    }

    // Validate body
    if (!bodyValidator.Check(request.body)) {
        const bodyErrors = [...bodyValidator.Errors(request.body)];
        allErrors.push(...bodyErrors.map(error => ({
            section: 'body',
            path: error.path,
            message: error.message,
            value: error.value
        })));
    }

    // If there are any validation errors, log them and return 400
    if (allErrors.length > 0) {
        request.log.warn({
            validationErrors: allErrors,
            url: request.url,
            method: request.method
        }, 'Request validation failed');

        reply.code(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'Validation failed',
            details: allErrors
        });
        return;
    }

    done();
}
