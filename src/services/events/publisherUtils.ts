import type {FastifyRequest} from 'fastify';
import {PageHitRaw, PageHitRequestType, type TinybirdSyncEvent} from '../../schemas';
import {publishEvent} from './publisher';

export const publishPageHitRaw = async (request: PageHitRequestType, payload: PageHitRaw): Promise<void> => {
    const topic = process.env.PUBSUB_TOPIC_PAGE_HITS_RAW as string;
    if (topic) {
        const eventId = payload.payload.event_id ?? 'unknown';
        request.log.debug({
            event: 'PublishingPageHitRawEvent',
            event_id: eventId,
            payload
        });
        const start = performance.now();
        const messageId = await publishEvent({
            topic,
            payload,
            logger: request.log
        });
        request.log.info({
            event: 'PublishedPageHitRawEvent',
            durationMs: performance.now() - start,
            message_id: messageId,
            event_id: eventId
        });
        request.log.debug({
            event: 'PublishedPageHitRawEventPayload',
            event_id: eventId,
            message_id: messageId,
            payload
        });
    }
};

export const publishTinybirdSyncEvent = async (request: FastifyRequest, payload: TinybirdSyncEvent): Promise<void> => {
    const topic = process.env.PUBSUB_TOPIC_TINYBIRD_SYNC;
    if (topic) {
        request.log.debug({
            event: 'PublishingTinybirdSyncEvent',
            tinybird_sync_event_id: payload.id,
            tinybird_sync_event_type: payload.type,
            payload
        });
        const start = performance.now();
        const messageId = await publishEvent({
            topic,
            payload,
            logger: request.log
        });
        request.log.info({
            event: 'PublishedTinybirdSyncEvent',
            durationMs: performance.now() - start,
            message_id: messageId,
            tinybird_sync_event_id: payload.id,
            tinybird_sync_event_type: payload.type
        });
    }
};
