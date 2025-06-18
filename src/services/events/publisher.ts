import {PubSub} from '@google-cloud/pubsub';
import logger from '../../utils/logger.js';
import config from '@tryghost/config';

export interface PublishEventOptions {
    topic: string;
    payload: Record<string, unknown>;
}

class EventPublisher {
    private static instance: EventPublisher;
    private pubsub: PubSub;

    private constructor() {
        this.pubsub = new PubSub({
            projectId: config.get('GOOGLE_CLOUD_PROJECT')
        });
    }

    static getInstance(): EventPublisher {
        if (!EventPublisher.instance) {
            EventPublisher.instance = new EventPublisher();
        }
        return EventPublisher.instance;
    }

    async publishEvent({topic, payload}: PublishEventOptions): Promise<string> {
        try {
            const message = {
                data: Buffer.from(JSON.stringify(payload)),
                timestamp: new Date().toISOString()
            };

            const messageId = await this.pubsub.topic(topic).publishMessage(message);
            
            logger.info({
                messageId,
                topic,
                payloadSize: message.data.length
            }, 'Event published successfully');

            return messageId;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error({
                error: errorMessage,
                topic,
                payload
            }, 'Failed to publish event');
            throw error;
        }
    }
}

export const publishEvent = async ({topic, payload}: PublishEventOptions): Promise<string> => {
    const publisher = EventPublisher.getInstance();
    return publisher.publishEvent({topic, payload});
};