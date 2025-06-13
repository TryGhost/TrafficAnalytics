import {FastifyRequest, FastifyReply} from '../../types';
import * as validators from './validators';
import {parseReferrer} from './processors/url-referrer';
import {parseUserAgent} from './processors/parse-user-agent';
import {generateUserSignature} from './processors/user-signature';
import {publishRawEventToPubSub} from '../pubsub';

// Accepts a request object
// Does some processing — user agent parsing, geoip lookup, etc.
// Modifies the request object in place
// Called within the HTTP proxy route
// Eventually will be called on each request pulled from the queue
export async function processRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
        // NEW: Capture RAW event data BEFORE any enrichment
        if (process.env.ENABLE_PUBSUB_PUBLISHING === 'true') {
            // Create a deep copy of the request data before any modifications
            const rawRequestData = {
                body: JSON.parse(JSON.stringify(request.body)),
                query: {...request.query},
                headers: {
                    'user-agent': request.headers['user-agent'],
                    referer: request.headers.referer
                },
                ip: request.ip
            };
            
            // Wait-and-retry pattern for better reliability
            try {
                await publishRawEventToPubSub(rawRequestData as FastifyRequest);
            } catch (error) {
                // Retry once, then log and continue
                try {
                    await publishRawEventToPubSub(rawRequestData as FastifyRequest);
                    request.log.warn('Pub/Sub publishing succeeded on retry');
                } catch (retryError) {
                    request.log.error({
                        originalError: error,
                        retryError: retryError,
                        eventId: request.body.session_id,
                        timestamp: request.body.timestamp
                    }, 'Pub/Sub publishing failed after retry');
                    // Don't fail the request - direct mode continues
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
