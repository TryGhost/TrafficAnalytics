const uap = require('ua-parser-js');

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
    parseUserAgent
};
