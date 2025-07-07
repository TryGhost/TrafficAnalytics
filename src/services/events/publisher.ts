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

    private constructor(pubsub?: PubSub) {
        this.pubsub = pubsub || new PubSub({
            projectId: process.env.GOOGLE_CLOUD_PROJECT
        });
    }

    static getInstance(): EventPublisher {
        if (!EventPublisher.instance) {
            EventPublisher.instance = new EventPublisher();
        }
        return EventPublisher.instance;
    }

    static resetInstance(pubsub?: PubSub): void {
        EventPublisher.instance = new EventPublisher(pubsub);
    }

    async publishEvent({topic, payload, logger}: PublishEventOptions): Promise<string> {
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

export const publishEvent = async ({topic, payload, logger}: PublishEventOptions): Promise<string> => {
    const publisher = EventPublisher.getInstance();
    return publisher.publishEvent({topic, payload, logger});
};

// Export for testing purposes
export {EventPublisher};