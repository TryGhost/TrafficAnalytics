import {FastifyRequest, FastifyReply} from '../../types';
import * as validators from './validators';
import {parseReferrer} from './processors/url-referrer';
import {parseUserAgent} from './processors/parse-user-agent';
import {generateUserSignature} from './processors/user-signature';
import {publishEvent} from '../pubsub';

// Accepts a request object
// Does some processing — user agent parsing, geoip lookup, etc.
// Modifies the request object in place
// Called within the HTTP proxy route
// Eventually will be called on each request pulled from the queue
export async function processRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
        // Publish raw event data before enrichment (if enabled)
        if (process.env.ENABLE_PUBSUB_PUBLISHING === 'true') {
            const topicName = process.env.PUBSUB_TOPIC_PAGE_HITS_RAW;
            if (topicName) {
                const rawEventData = {
                    body: JSON.parse(JSON.stringify(request.body)),
                    query: {...request.query},
                    headers: {
                        'user-agent': request.headers['user-agent'],
                        referer: request.headers.referer
                    },
                    ip: request.ip
                };

                try {
                    await publishEvent(topicName, rawEventData);
                } catch (error) {
                    request.log.error({
                        error: error,
                        eventId: request.body.session_id,
                        timestamp: request.body.timestamp
                    }, 'Pub/Sub publishing failed after retry');
                    // Continue with direct mode regardless of Pub/Sub failure
                }
            }
        }
        
        // Existing enrichment logic (unchanged)
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
