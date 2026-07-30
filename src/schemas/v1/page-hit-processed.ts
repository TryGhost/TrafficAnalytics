import {z} from 'zod';
import {PageHitRaw} from './page-hit-raw';
import type {ParsedReferrer} from './page-hit-raw';
import uap from 'ua-parser-js';
import {ReferrerParser} from '@tryghost/referrer-parser';
import {userSignatureService} from '../../services/user-signature';
import {isBot} from '../../utils/bot-detection';

const referrerParser = new ReferrerParser();

// See page-hit-request.ts: UUID-shaped is enough, RFC compliance is not required.
const UUIDSchema = z.guid();
const ISO8601DateTimeSchema = z.iso.datetime({precision: 3});
const NullableString = z.string().nullable();

// Complete page hit processed schema
export const PageHitProcessedSchema = z.object({
    timestamp: ISO8601DateTimeSchema,
    action: z.literal('page_hit'),
    version: z.literal('1'),
    site_uuid: UUIDSchema,
    session_id: z.string(),
    payload: z.object({
        event_id: UUIDSchema,
        site_uuid: UUIDSchema,
        member_uuid: z.union([UUIDSchema, z.literal('undefined')]),
        member_status: z.union([z.string().min(1), z.literal('undefined')]),
        post_uuid: z.union([UUIDSchema, z.literal('undefined')]),
        post_type: z.enum(['null', 'post', 'page']),
        gift_link: NullableString.optional(),
        locale: z.string().min(1),
        location: z.string().min(1).nullable(),
        pathname: z.string().min(1),
        href: z.string(),
        os: z.string(),
        browser: z.string(),
        device: z.string(),
        parsedReferrer: z.object({
            url: NullableString,
            source: NullableString,
            medium: NullableString
        }).optional(),
        referrerUrl: NullableString.optional(),
        referrerSource: NullableString.optional(),
        referrerMedium: NullableString.optional(),
        utm_source: NullableString.optional(),
        utm_medium: NullableString.optional(),
        utm_campaign: NullableString.optional(),
        utm_term: NullableString.optional(),
        utm_content: NullableString.optional(),
        'user-agent': z.string(),
        meta: z.object({
            received_timestamp: ISO8601DateTimeSchema.nullable()
        })
    })
});

export type PageHitProcessed = z.infer<typeof PageHitProcessedSchema>;

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

        // Normalize device type - check for bots first
        let deviceType = 'unknown';
        if (isBot(userAgent)) {
            deviceType = 'bot';
        } else if (osName === 'ios') {
            deviceType = 'mobile-ios';
        } else if (osName === 'android') {
            deviceType = 'mobile-android';
        } else if (['macos', 'windows', 'linux', 'chrome os', 'chromium os', 'ubuntu'].includes(osName)) {
            deviceType = 'desktop';
        }

        return {
            os: osName,
            browser: browserName,
            device: deviceType
        };
    } catch {
        return {
            os: 'unknown',
            browser: 'unknown',
            device: 'unknown'
        };
    }
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
    } catch {
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

    const pageHitProcessed = {
        timestamp: pageHitRaw.timestamp,
        action: pageHitRaw.action,
        version: pageHitRaw.version,
        site_uuid: pageHitRaw.site_uuid,
        session_id: sessionId,
        payload: {
            event_id: pageHitRaw.payload.event_id ?? crypto.randomUUID(),
            site_uuid: pageHitRaw.site_uuid,
            member_uuid: pageHitRaw.payload.member_uuid,
            member_status: pageHitRaw.payload.member_status,
            post_uuid: pageHitRaw.payload.post_uuid,
            post_type: pageHitRaw.payload.post_type,
            gift_link: pageHitRaw.payload.gift_link,
            locale: pageHitRaw.payload.locale,
            location: pageHitRaw.payload.location,
            pathname: pageHitRaw.payload.pathname,
            href: pageHitRaw.payload.href,
            parsedReferrer: pageHitRaw.payload.parsedReferrer, // for auditing purposes
            ...userAgentData,
            ...referrerData,
            utm_source: pageHitRaw.payload.utm_source,
            utm_medium: pageHitRaw.payload.utm_medium,
            utm_campaign: pageHitRaw.payload.utm_campaign,
            utm_term: pageHitRaw.payload.utm_term,
            utm_content: pageHitRaw.payload.utm_content,
            'user-agent': pageHitRaw.meta['user-agent'],
            meta: {
                received_timestamp: pageHitRaw.payload.meta.received_timestamp
            }
        }
    };
    return pageHitProcessed;
}
