import {PageHitRequestType} from '../../schemas';
import {pageHitRawPayloadFromRequest} from '../../transformations/page-hit-transformations';
import {publishEvent} from './publisher';

export const publishPageHitRaw = async (request: PageHitRequestType): Promise<void> => {
    const topic = process.env.PUBSUB_TOPIC_PAGE_HITS_RAW as string;
    if (topic) {
        const payload = pageHitRawPayloadFromRequest(request);
        request.log.info({event_id: payload.payload.event_id}, 'Publishing page hit raw event');
        await publishEvent({
            topic,
            payload,
            logger: request.log
        });
    }
};
