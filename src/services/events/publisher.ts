import {PubSub} from '@google-cloud/pubsub';
import type {FastifyBaseLogger} from 'fastify';

export interface PublishEventOptions {
    topic: string;
    payload: Record<string, unknown>;
    logger: FastifyBaseLogger;
}

class EventPublisher {
    private static instance: EventPublisher;
    private pubsub: PubSub;

    private constructor() {
        this.pubsub = new PubSub({
            projectId: process.env.GOOGLE_CLOUD_PROJECT
        });
    }

    static getInstance(): EventPublisher {
        if (!EventPublisher.instance) {
            EventPublisher.instance = new EventPublisher();
        }
        return EventPublisher.instance;
    }

    async publishEvent({topic, payload, logger}: PublishEventOptions): Promise<string> {
        try {
            const message = {
                data: Buffer.from(JSON.stringify(payload)),
                timestamp: new Date().toISOString()
            };

            const messageId = await this.pubsub.topic(topic).publishMessage(message);

            logger.info({
                event: 'EventPublishSuccessful',
                messageId,
                topic,
                payloadSize: message.data.length
            });

            return messageId;
        } catch (err) {
            logger.error({
                event: 'EventPublishFailed',
                err,
                topic,
                payload
            });
            throw err;
        }
    }
}

export const publishEvent = async ({topic, payload, logger}: PublishEventOptions): Promise<string> => {
    const publisher = EventPublisher.getInstance();
    return publisher.publishEvent({topic, payload, logger});
};
