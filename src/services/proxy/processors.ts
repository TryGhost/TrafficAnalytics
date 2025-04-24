import uap from 'ua-parser-js';
import {FastifyRequest, PayloadMeta} from '../../types';

function isBot(userAgentString: string): boolean {
    const botPattern = /wget|ahrefsbot|curl|bot|crawler|spider|urllib|bitdiscovery|\+https:\/\/|googlebot/i;
    return botPattern.test(userAgentString);
}

export function parseUserAgent(request: FastifyRequest): void {
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

        request.body.payload.os = osName;
        request.body.payload.browser = browserName;
        request.body.payload.device = deviceType;
    } catch (error) {
        request.log.error(error);
        // We should fail silently here, because we don't want to break the proxy for non-critical functionality
    }
}
