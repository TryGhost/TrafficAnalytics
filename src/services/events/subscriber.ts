import {PubSub, type Subscription} from '@google-cloud/pubsub';
import type {Message} from '@google-cloud/pubsub';
import errors from '@tryghost/errors';
import logger from '../../utils/logger.js';

export class EventSubscriber {
    private pubsub: PubSub;
    private subscription: Subscription;

    constructor(subscriptionName: string) {
        if (!subscriptionName) {
            throw new errors.IncorrectUsageError({
                message: 'Subscription name is required to create an event subscriber'
            });
        }
        if (!process.env.GOOGLE_CLOUD_PROJECT) {
            throw new errors.IncorrectUsageError({
                message: 'GOOGLE_CLOUD_PROJECT environment variable is required to create an event subscriber'
            });
        }

        this.pubsub = new PubSub({
            projectId: process.env.GOOGLE_CLOUD_PROJECT
        });
        try {
            this.subscription = this.pubsub.subscription(subscriptionName);
            logger.info({
                subscriptionName: this.subscription.name
            }, 'Event subscriber created successfully');
        } catch (error) {
            throw new errors.IncorrectUsageError({
                message: `Failed to create an event subscriber: ${subscriptionName}`
            });
        }
    }

    subscribe(handler: (message: Message) => void): void {
        logger.info({
            subscriptionName: this.subscription.name
        }, `Subscribing to event`);
        this.subscription.on('message', handler);
    }

    async close(): Promise<void> {
        await this.subscription.close();
    }
}

export default EventSubscriber;