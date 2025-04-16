const uap = require('ua-parser-js');

function isBot(userAgentString) {
    const botPattern = /wget|ahrefsbot|curl|bot|crawler|spider|urllib|bitdiscovery|\+https:\/\/|googlebot/i;
    return botPattern.test(userAgentString);
}

function parseUserAgent(request) {
    if (!request.headers['user-agent']) {
        return;
    }

    try {
        const userAgent = request.headers['user-agent'];
        const ua = new uap(userAgent);
        const os = ua.getOS();
        const browser = ua.getBrowser();

        // Normalize browser name (e.g., "Mobile Safari" -> "Safari")
        let browserName = browser.name?.toLowerCase() || 'unknown';
        browserName = browserName.replace(/^mobile\s/, '');

        // Normalize Mac OS and macOS
        let osName = os.name?.toLowerCase() || 'unknown';
        if (osName === 'mac os') {
            osName = 'macos';
        }

        // Normalize device type
        let deviceType = 'unknown';
        if (osName === 'ios') {
            deviceType = 'mobile-ios';
        } else if (osName === 'android') {
            deviceType = 'mobile-android';
        } else if (['macos', 'windows', 'linux', 'chrome os', 'ubuntu'].includes(osName)) {
            deviceType = 'desktop';
        } else if (isBot(userAgent)) {
            deviceType = 'bot';
        }

        request.body.payload.meta = {};
        request.body.payload.meta.os = osName;
        request.body.payload.meta.browser = browserName;
        request.body.payload.meta.device = deviceType;
    } catch (error) {
        request.log.error(error);
        // We should fail silently here, because we don't want to break the proxy for non-critical functionality
        request.body.payload.meta = {};
        request.body.payload.meta.os = 'unknown';
        request.body.payload.meta.browser = 'unknown';
        request.body.payload.meta.device = 'unknown';
    }
}

module.exports = {
    parseUserAgent
};
