import {PubSub} from '@google-cloud/pubsub';
import {FastifyRequest} from '../../types';

let pubsubClient: PubSub | null = null;

function getPubSubClient(): PubSub {
    if (!pubsubClient) {
        pubsubClient = new PubSub();
    }
    return pubsubClient;
}

export async function publishRawEventToPubSub(request: FastifyRequest): Promise<void> {
    const topicName = process.env.PUBSUB_TOPIC_NAME;
    if (!topicName) {
        throw new Error('PUBSUB_TOPIC_NAME environment variable is required');
    }

    const client = getPubSubClient();
    const topic = client.topic(topicName);

    // Create raw event data (BEFORE any enrichment)
    const rawEventData = {
        timestamp: request.body.timestamp,
        action: request.body.action,
        version: request.body.version,
        session_id: request.body.session_id,
        payload: request.body.payload, // Original payload, no enrichment
        query: request.query,
        headers: {
            'user-agent': request.headers['user-agent'],
            referer: request.headers.referer
        },
        ip: request.ip
    };

    // Non-blocking publish of raw data
    await topic.publishMessage({
        data: Buffer.from(JSON.stringify(rawEventData))
    });
}

// For testing purposes - allows injecting a mock client
export function setPubSubClient(client: PubSub | null): void {
    pubsubClient = client;
}