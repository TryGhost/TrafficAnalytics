import {FastifyRequest, FastifyReply} from '../../types';
import * as validators from './validators';
import {handleSiteUUIDHeader} from './processors/handle-site-uuid-header';
import {parseReferrer} from './processors/url-referrer';
import {parseUserAgent} from './processors/parse-user-agent';
import {generateUserSignature} from './processors/user-signature';
import {publishEvent} from '../events/publisher.js';

// Accepts a request object
// Does some processing — user agent parsing, geoip lookup, etc.
// Modifies the request object in place
// Called within the HTTP proxy route
// Eventually will be called on each request pulled from the queue
export async function processRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    handleSiteUUIDHeader(request);

    try {
        // Publish raw page hit event to Pub/Sub BEFORE any processing (if topic is configured)
        // This is fire-and-forget - don't let Pub/Sub errors break the proxy
        const topic = process.env.PUBSUB_TOPIC_PAGE_HITS_RAW as string;
        if (topic) {
            try {
                await publishEvent({
                    topic,
                    payload: {
                        timestamp: new Date().toISOString(),
                        method: request.method,
                        url: request.url,
                        headers: request.headers,
                        body: request.body,
                        ip: request.ip
                    },
                    logger: request.log
                });
            } catch (error) {
                // Log the error but don't let it affect the request
                request.log.warn({
                    error: error instanceof Error ? error.message : String(error),
                    topic
                }, 'Failed to publish page hit event - continuing with request');
            }
        }

        parseUserAgent(request);
        parseReferrer(request);
        await generateUserSignature(request);
    } catch (error) {
        reply.code(500).send(error);
        throw error; // Re-throw to let Fastify handle it
    }
}

export function validateRequest(request: FastifyRequest, reply: FastifyReply, done: () => void): void {
    try {
        validators.validateSiteUUID(request);
        validators.validateQueryParams(request);
        validators.validateRequestBody(request);
    } catch (error) {
        // TODO: This should just throw an error, not return a reply
        // This should be decoupled from the HTTP proxy route
        reply.code(400).send(error);
        return;
    }

    done();
}
