import {describe, it, expect, beforeAll, vi, afterAll} from 'vitest';
import EventSubscriber from '../../../../src/services/events/subscriber.js';
import {publishEvent} from '../../../../src/services/events/publisher.js';
import {createMockLogger} from '../../../utils/mock-logger.js';

describe('EventSubscriber Integration Tests', () => {
    let subscriber: EventSubscriber;
    let subscriptionName: string;
    let topicName: string;
    let mockLogger: ReturnType<typeof createMockLogger>;

    beforeAll(async () => {
        topicName = process.env.PUBSUB_TOPIC_PAGE_HITS_RAW!;
        subscriptionName = process.env.PUBSUB_SUBSCRIPTION_PAGE_HITS_RAW!;
        
        subscriber = new EventSubscriber(subscriptionName);
        mockLogger = createMockLogger();
    });

    afterAll(async function () {
        await subscriber.close();
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