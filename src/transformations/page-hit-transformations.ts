import {randomUUID} from 'crypto';
import {PageHitRequestType, PageHitRaw} from '../schemas';

export const pageHitRawPayloadFromRequest = (request: PageHitRequestType): PageHitRaw => {
    return {
        timestamp: request.body.timestamp,
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
            utmSource: request.body.payload.utmSource ?? null,
            utmMedium: request.body.payload.utmMedium ?? null,
            utmCampaign: request.body.payload.utmCampaign ?? null,
            utmTerm: request.body.payload.utmTerm ?? null,
            utmContent: request.body.payload.utmContent ?? null
        },
        meta: {
            ip: request.ip,
            'user-agent': request.headers['user-agent']
        }
    };
};
