import type {FastifyRequest} from 'fastify';
import {type AutomationEventChunk, PageHitRaw, PageHitRequestType} from '../../schemas';
import {publishEvent} from './publisher';

export const publishAutomationChunk = async (request: FastifyRequest, chunk: AutomationEventChunk): Promise<void> => {
    const topic = process.env.PUBSUB_TOPIC_AUTOMATION_EVENTS;
    if (topic) {
        const messageId = await publishEvent({
            topic,
            payload: chunk,
            logger: request.log
        });
        request.log.info({
            event: 'PublishedAutomationChunk',
            message_id: messageId,
            automation_event_type: chunk.type,
            event_count: chunk.events.length
        });
    }
};

export const publishPageHitRaw = async (request: PageHitRequestType, payload: PageHitRaw): Promise<void> => {
    const topic = process.env.PUBSUB_TOPIC_PAGE_HITS_RAW as string;
    if (topic) {
        const eventId = payload.payload.event_id ?? 'unknown';
        request.log.debug({
            event: 'PublishingPageHitRawEvent',
            event_id: eventId,
            payload
        });
        const messageId = await publishEvent({
            topic,
            payload,
            logger: request.log
        });
        request.log.info({
            event: 'PublishedPageHitRawEvent',
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
