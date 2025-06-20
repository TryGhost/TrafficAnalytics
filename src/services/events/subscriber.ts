import {PubSub, type Subscription} from '@google-cloud/pubsub';

export class EventSubscriber {
    private static instance: EventSubscriber;
    private pubsub: PubSub;
    private subscription: Subscription;

    private constructor(subscriptionName: string) {
        this.pubsub = new PubSub({
            projectId: process.env.GOOGLE_CLOUD_PROJECT
        });

        this.subscription = this.pubsub.subscription(subscriptionName);
    }

    subscribe(handler: (message: unknown) => void): void {
        this.subscription.on('message', handler);
    }

    async close(): Promise<void> {
        await this.subscription.close();
    }
}