import {PageHitRaw, PageHitRequestType} from '../../schemas';
import {publishEvent} from './publisher';

export const publishPageHitRaw = async (request: PageHitRequestType, payload: PageHitRaw): Promise<void> => {
    const topic = process.env.PUBSUB_TOPIC_PAGE_HITS_RAW as string;
    if (topic) {
        request.log.debug({
            event: 'PublishingPageHitRawEvent',
            event_id: payload.payload.event_id,
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
            event_id: payload.payload.event_id
        });
        request.log.debug({
            event: 'PublishedPageHitRawEventPayload',
            event_id: payload.payload.event_id,
            message_id: messageId,
            payload
         });
    }
};
