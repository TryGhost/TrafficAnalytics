import {PageHitRaw, PageHitRequestType} from '../../schemas';
import {publishEvent} from './publisher';

export const publishPageHitRaw = async (request: PageHitRequestType, payload: PageHitRaw): Promise<void> => {
    const topic = process.env.PUBSUB_TOPIC_PAGE_HITS_RAW as string;
    if (topic) {
        request.log.info({event: 'PublishingPageHitRawEvent', event_id: payload.payload.event_id});
        request.log.debug({event: 'PublishingPageHitRawEventPayload', payload});
        await publishEvent({
            topic,
            payload,
            logger: request.log
        });
    }
};
