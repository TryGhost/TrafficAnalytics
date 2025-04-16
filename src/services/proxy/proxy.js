const validators = require('./validators');
const processors = require('./processors');

// Accepts a request object
// Does some processing — user agent parsing, geoip lookup, etc.
// Modifies the request object in place
// Called within the HTTP proxy route
// Eventually will be called on each request pulled from the queue
function processRequest(request, reply, done) {
    try {
        processors.parseUserAgent(request);
    } catch (error) {
        reply.code(500).send(error);
        return;
    }
    done();
}

function validateRequest(request, reply, done) {
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

module.exports = {
    processRequest,
    validateRequest
};
