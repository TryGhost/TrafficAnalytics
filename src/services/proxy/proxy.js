const uap = require('ua-parser-js');

// Accepts a request object
// Does some processing — user agent parsing, geoip lookup, etc.
// Modifies the request object in place
// Called within the HTTP proxy route
// Eventually will be called on each request pulled from the queue
function processRequest(request, reply, done) {
    parseUserAgent(request);
    done();
}

function validateRequest(request, reply, done) {
    // Validate the request before proxying it
    const token = request.query.token;
    const name = request.query.name;

    // Verify both token and name are present and not empty
    if (!token || token.trim() === '' || !name || name.trim() === '') {
        reply.code(400).send({
            error: 'Bad Request',
            message: 'Token and name query parameters are required'
        });
        return;
    }

    // Validate the request body
    if (!request.body || Object.keys(request.body).length === 0 || !request.body.payload) {
        reply.code(400).send({
            error: 'Bad Request',
            message: 'Request body is required'
        });
        return;
    }

    done();
}

function parseUserAgent(request) {
    if (!request.headers['user-agent']) {
        return;
    }

    try {
        const ua = new uap(request.headers['user-agent']);
        const os = ua.getOS() || {name: 'unknown', version: 'unknown'};
        const browser = ua.getBrowser() || {name: 'unknown', version: 'unknown', major: 'unknown', type: 'unknown'};
        const device = ua.getDevice() || {type: 'unknown', vendor: 'unknown', model: 'unknown'};
        request.body.payload.meta = {};
        request.body.payload.meta.os = os;
        request.body.payload.meta.browser = browser;
        request.body.payload.meta.device = device;
    } catch (error) {
        request.log.error(error);
        // We should fail silently here, because we don't want to break the proxy for non-critical functionality
    }
}

module.exports = {
    processRequest,
    validateRequest
};
