import {FastifyRequest, FastifyReply} from '../../types';
import * as validators from './validators';
import * as processors from './processors';
import {parseReferrer} from './processors/url-referrer';

// Accepts a request object
// Does some processing — user agent parsing, geoip lookup, etc.
// Modifies the request object in place
// Called within the HTTP proxy route
// Eventually will be called on each request pulled from the queue
export function processRequest(request: FastifyRequest, reply: FastifyReply, done: () => void): void {
    try {
        processors.parseUserAgent(request);
        parseReferrer(request);
    } catch (error) {
        reply.code(500).send(error);
        return;
    }
    done();
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
