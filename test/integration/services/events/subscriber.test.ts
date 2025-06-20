import {describe, it, expect, beforeAll, vi, afterAll} from 'vitest';
import EventSubscriber from '../../../../src/services/events/subscriber.js';
import {publishEvent} from '../../../../src/services/events/publisher.js';
import {createMockLogger} from '../../../utils/mock-logger.js';
import {createTopic, createSubscription, deleteSubscription, deleteTopic} from '../../../utils/pubsub.js';

const mockLogger = createMockLogger();

describe('EventSubscriber Integration Tests', () => {
    let subscriber: EventSubscriber;
    let subscriptionName: string;
    let topicName: string;

    beforeAll(async () => {
        topicName = process.env.PUBSUB_TOPIC_PAGE_HITS_RAW || 'test-traffic-analytics-page-hits-raw';
        subscriptionName = process.env.PUBSUB_SUBSCRIPTION_PAGE_HITS_RAW || 'test-subscription';
        
        // Ensure topic and subscription exist
        try {
            await createTopic(topicName);
            await createSubscription(topicName, subscriptionName);
        } catch (error) {
            // Ignore errors - Pub/Sub might not be available in all test environments
        }
        
        subscriber = new EventSubscriber(subscriptionName);
    });

    afterAll(async function () {
        // Close the subscriber first to stop any active connections
        if (subscriber) {
            await subscriber.close();
        }
        
        // Delete subscription first, then topic
        try {
            await deleteSubscription(subscriptionName);
        } catch (error) {
            // Ignore errors - subscription might not exist
        }
        
        try {
            await deleteTopic(topicName);
        } catch (error) {
            // Ignore errors - topic might not exist
        }
    });

    it('should subscribe to a Pub/Sub topic', async () => {
        const expectedPayload = {
            message: 'test'
        };

        const eventPromise = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Message not received within 1000ms'));
            }, 1000);

            const messageHandler = vi.fn().mockImplementation((message) => {
                clearTimeout(timeout);
                const data = JSON.parse(message.data.toString());
                expect(data).toEqual(expectedPayload);
                message.ack();
                resolve();
            });

            subscriber.subscribe(messageHandler);

            // Add a small delay to ensure subscription is ready before publishing
            setTimeout(() => {
                publishEvent({
                    topic: topicName,
                    payload: expectedPayload,
                    logger: mockLogger
                });
            }, 100);
        });

        await eventPromise;
    });
});