import {randomUUID} from 'crypto';
import {PageHitRequestType, PageHitRaw} from '../schemas';

export const pageHitRawPayloadFromRequest = (request: PageHitRequestType): PageHitRaw => {
    const parseReceivedTimestamp = (value: string | undefined) => {
        if (value === undefined) {
            return null;
        }

        try {
            return (new Date(parseInt(value))).toISOString();
        } catch {
            return null;
        }
    };

    return {
        timestamp: request.serverReceivedAt.toISOString(),
        action: request.body.action,
        version: request.body.version,
        site_uuid: request.headers['x-site-uuid'],
        payload: {
            event_id: request.body.payload.event_id && request.body.payload.event_id.length > 0 ? request.body.payload.event_id : randomUUID(),
            member_uuid: request.body.payload.member_uuid,
            member_status: request.body.payload.member_status,
            post_uuid: request.body.payload.post_uuid,
            post_type: request.body.payload.post_type,
            locale: request.body.payload.locale,
            location: request.body.payload.location,
            referrer: request.body.payload.referrer ?? null,
            parsedReferrer: request.body.payload.parsedReferrer,
            pathname: request.body.payload.pathname,
            href: request.body.payload.href,
            utm_source: request.body.payload.utm_source ?? null,
            utm_medium: request.body.payload.utm_medium ?? null,
            utm_campaign: request.body.payload.utm_campaign ?? null,
            utm_term: request.body.payload.utm_term ?? null,
            utm_content: request.body.payload.utm_content ?? null,
            meta: {
                received_timestamp: parseReceivedTimestamp(request.headers['x-ghost-analytics-start'])
            }
        },
        meta: {
            ip: request.ip,
            'user-agent': request.headers['user-agent']
        }
    };
};
