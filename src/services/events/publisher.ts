import {PubSub, type Topic} from '@google-cloud/pubsub';
import type {FastifyBaseLogger} from 'fastify';

export interface PublishEventOptions {
    topic: string;
    payload: Record<string, unknown>;
    logger: FastifyBaseLogger;
}

class EventPublisher {
    private static instance: EventPublisher;
    private pubsub: PubSub;
    private topics = new Map<string, Topic>();

    private constructor() {
        this.pubsub = new PubSub({
            projectId: process.env.GOOGLE_CLOUD_PROJECT,
            enableOpenTelemetryTracing: true
        });
    }

    static getInstance(): EventPublisher {
        if (!EventPublisher.instance) {
            EventPublisher.instance = new EventPublisher();
        }
        return EventPublisher.instance;
    }

    private getTopic(name: string): Topic {
        let topic = this.topics.get(name);
        if (!topic) {
            topic = this.pubsub.topic(name);
            this.topics.set(name, topic);
        }
        return topic;
    }

    async publishEvent({topic, payload, logger}: PublishEventOptions): Promise<string> {
        try {
            const message = {
                data: Buffer.from(JSON.stringify(payload)),
                timestamp: new Date().toISOString()
            };

            const messageId = await this.getTopic(topic).publishMessage(message);

            logger.debug({
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
