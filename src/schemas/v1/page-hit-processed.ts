import {Type, Static} from '@sinclair/typebox';
import {PageHitRaw} from './page-hit-raw';
import type {ParsedReferrer} from './page-hit-raw';
import uap from 'ua-parser-js';
import {ReferrerParser} from '@tryghost/referrer-parser';
import {userSignatureService} from '../../services/user-signature';

const referrerParser = new ReferrerParser();

// Complete page hit processed schema
export const PageHitProcessedSchema = Type.Object({
    timestamp: Type.String({format: 'date-time'}),
    action: Type.Literal('page_hit'),
    version: Type.Literal('1'),
    site_uuid: Type.String({format: 'uuid'}),
    session_id: Type.String(),
    payload: Type.Object({
        event_id: Type.String({format: 'uuid'}),
        site_uuid: Type.String({format: 'uuid'}),
        member_uuid: Type.Union([Type.String({format: 'uuid'}), Type.Literal('undefined')]),
        member_status: Type.Union([Type.String({minLength: 1}), Type.Literal('undefined')]),
        post_uuid: Type.Union([Type.String({format: 'uuid'}), Type.Literal('undefined')]),
        post_type: Type.Union([Type.Literal('null'), Type.Literal('post'), Type.Literal('page')]),
        locale: Type.String({minLength: 1}),
        location: Type.Union([Type.String({minLength: 1}), Type.Null()]),
        referrer: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        pathname: Type.String({minLength: 1}),
        href: Type.String({format: 'uri'}),
        os: Type.String(),
        browser: Type.String(),
        device: Type.String(),
        referrerUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        referrerSource: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        referrerMedium: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        'user-agent': Type.String()

    })
});

export type PageHitProcessed = Static<typeof PageHitProcessedSchema>;

// Transform functions
// NOTE: These functions are deliberately duplicated from the proxy service /processors
// We will eventually use these transforms for both the proxy service and the batch worker
export function transformUserAgent(userAgent: string): {os: string, browser: string, device: string} {
    try {
        if (!userAgent) {
            return {
                os: 'unknown',
                browser: 'unknown',
                device: 'unknown'
            };
        }

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
        } else if (['macos', 'windows', 'linux', 'chrome os', 'chromium os', 'ubuntu'].includes(osName)) {
            deviceType = 'desktop';
        } else if (isBot(userAgent)) {
            deviceType = 'bot';
        }

        return {
            os: osName,
            browser: browserName,
            device: deviceType
        };
    } catch (error) {
        return {
            os: 'unknown',
            browser: 'unknown',
            device: 'unknown'
        };
    }
}

function isBot(userAgentString: string): boolean {
    const botPattern = /wget|ahrefsbot|curl|bot|crawler|spider|urllib|bitdiscovery|\+https:\/\/|googlebot/i;
    return botPattern.test(userAgentString);
}

export function transformReferrer(referrerData: ParsedReferrer | undefined): {
    referrerUrl?: string | null,
    referrerSource?: string | null,
    referrerMedium?: string | null
} {
    if (!referrerParser || !referrerData || typeof referrerData !== 'object' || !referrerData.url) {
        return {};
    }

    try {
        const parsedReferrer = referrerParser.parse(referrerData.url, referrerData.source ?? undefined, referrerData.medium ?? undefined);
        return {
            referrerUrl: parsedReferrer.referrerUrl || null,
            referrerSource: parsedReferrer.referrerSource || null,
            referrerMedium: parsedReferrer.referrerMedium || null
        };
    } catch (error) {
        return {};
    }
}

export async function generateUserSignature(
    siteUuid: string,
    ipAddress: string,
    userAgent: string
): Promise<string> {
    return await userSignatureService.generateUserSignature(siteUuid, ipAddress, userAgent);
}

export async function transformPageHitRawToProcessed(
    pageHitRaw: PageHitRaw
): Promise<PageHitProcessed> {
    const userAgentData = transformUserAgent(pageHitRaw.meta['user-agent']);
    const referrerData = transformReferrer(pageHitRaw.payload.parsedReferrer);
    const sessionId = await generateUserSignature(
        pageHitRaw.site_uuid,
        pageHitRaw.meta.ip,
        pageHitRaw.meta['user-agent']
    );

    const referrer = pageHitRaw.payload.parsedReferrer?.source ?? pageHitRaw.payload.referrer ?? null;

    return {
        timestamp: pageHitRaw.timestamp,
        action: pageHitRaw.action,
        version: pageHitRaw.version,
        site_uuid: pageHitRaw.site_uuid,
        session_id: sessionId,
        payload: {
            event_id: pageHitRaw.payload.event_id ?? crypto.randomUUID(),
            site_uuid: pageHitRaw.site_uuid,
            ...pageHitRaw.payload,
            referrer,
            ...userAgentData,
            ...referrerData,
            'user-agent': pageHitRaw.meta['user-agent']
        }
    };
}