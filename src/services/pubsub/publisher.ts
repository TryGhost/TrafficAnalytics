import {PubSub} from '@google-cloud/pubsub';

let pubsubClient: PubSub | null = null;

function getPubSubClient(): PubSub {
    if (!pubsubClient) {
        pubsubClient = new PubSub();
    }
    return pubsubClient;
}

export async function publishEvent(topicName: string, payload: Record<string, unknown>): Promise<void> {
    const client = getPubSubClient();
    const topic = client.topic(topicName);

    // First attempt
    try {
        await topic.publishMessage({
            data: Buffer.from(JSON.stringify(payload))
        });
        return;
    } catch (error) {
        // Retry once
        try {
            await topic.publishMessage({
                data: Buffer.from(JSON.stringify(payload))
            });
        } catch (retryError) {
            // Re-throw the retry error to be handled by caller
            throw retryError;
        }
    }
}

// For testing purposes - allows injecting a mock client
export function setPubSubClient(client: PubSub | null): void {
    pubsubClient = client;
}