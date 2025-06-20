import {PubSub, Topic, Subscription} from '@google-cloud/pubsub';

let pubsubClient: PubSub | null = null;

/**
 * Get or create a singleton PubSub client
 */
function getPubSubClient(): PubSub {
    if (!pubsubClient) {
        pubsubClient = new PubSub({
            projectId: process.env.GOOGLE_CLOUD_PROJECT
        });
    }
    return pubsubClient;
}

/**
 * Creates a Pub/Sub topic if it doesn't already exist
 */
export async function createTopic(topicName: string): Promise<Topic> {
    const pubsub = getPubSubClient();
    const topic = pubsub.topic(topicName);
    
    const [exists] = await topic.exists();
    if (!exists) {
        const [createdTopic] = await topic.create();
        return createdTopic;
    }
    
    return topic;
}

/**
 * Deletes a Pub/Sub topic
 */
export async function deleteTopic(topicName: string): Promise<void> {
    const pubsub = getPubSubClient();
    const topic = pubsub.topic(topicName);
    
    const [exists] = await topic.exists();
    if (exists) {
        await topic.delete();
    }
}

/**
 * Creates a subscription on a topic
 */
export async function createSubscription(topicName: string, subscriptionName: string): Promise<Subscription> {
    const pubsub = getPubSubClient();
    const topic = pubsub.topic(topicName);
    
    // Ensure topic exists first
    const [topicExists] = await topic.exists();
    if (!topicExists) {
        throw new Error(`Topic ${topicName} does not exist. Create it first.`);
    }
    
    const subscription = pubsub.subscription(subscriptionName);
    const [exists] = await subscription.exists();
    
    if (!exists) {
        const [createdSubscription] = await topic.createSubscription(subscriptionName);
        return createdSubscription;
    }
    
    return subscription;
}

/**
 * Deletes a subscription
 */
export async function deleteSubscription(subscriptionName: string): Promise<void> {
    const pubsub = getPubSubClient();
    const subscription = pubsub.subscription(subscriptionName);
    
    const [exists] = await subscription.exists();
    if (exists) {
        await subscription.delete();
    }
}

/**
 * Closes/stops a subscription without deleting it
 */
export async function closeSubscription(subscriptionName: string): Promise<void> {
    const pubsub = getPubSubClient();
    const subscription = pubsub.subscription(subscriptionName);
    
    const [exists] = await subscription.exists();
    if (exists) {
        await subscription.close();
    }
}

/**
 * Generates a unique subscription name for test isolation
 */
export function generateUniqueSubscriptionName(prefix: string = 'test-sub'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `${prefix}-${timestamp}-${random}`;
}

/**
 * Test utility to clean up all test subscriptions matching a pattern
 * Useful in test teardown to clean up any orphaned subscriptions
 */
export async function cleanupTestSubscriptions(namePattern: RegExp = /^test-/): Promise<void> {
    const pubsub = getPubSubClient();
    
    try {
        const [subscriptions] = await pubsub.getSubscriptions();
        
        const deletePromises = subscriptions
            .filter(sub => namePattern.test(sub.name.split('/').pop() || ''))
            .map(sub => sub.delete().catch(() => {})); // Ignore errors during cleanup
        
        await Promise.all(deletePromises);
    } catch (error) {
        // Ignore cleanup errors
    }
}