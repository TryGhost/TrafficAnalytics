import {describe, it, expect, beforeAll} from 'vitest';
import {PubSub} from '@google-cloud/pubsub';
import {publishEvent} from '../../../../src/services/events/publisher.js';
import type {FastifyBaseLogger} from 'fastify';

describe('Publisher Integration Tests', () => {
    let pubsub: PubSub;
    let testTopic: string;
    let testPayload: Record<string, unknown>;
    let mockLogger: FastifyBaseLogger;

    beforeAll(async () => {
        // Use the same topic as the application for consistency
        testTopic = process.env.PUBSUB_TOPIC_PAGE_HITS_RAW || 'test-traffic-analytics-page-hits-raw';
        // Initialize mock logger
        mockLogger = {
            info: () => {},
            error: () => {},
            warn: () => {},
            debug: () => {},
            trace: () => {},
            fatal: () => {},
            level: 'info',
            silent: false,
            child: () => mockLogger
        } as unknown as FastifyBaseLogger;

        // Initialize test payload
        testPayload = {
            action: 'page_hit',
            timestamp: new Date().toISOString(),
            data: {
                url: 'https://example.com',
                user_agent: 'test-agent'
            }
        };

        // Initialize PubSub client for testing
        pubsub = new PubSub({
            projectId: process.env.GOOGLE_CLOUD_PROJECT || 'traffic-analytics-test'
        });

        // Ensure the topic exists (create if needed, but don't delete it)
        const topic = pubsub.topic(testTopic);
        const [exists] = await topic.exists();
        if (!exists) {
            throw new Error(`Topic ${testTopic} does not exist. Ensure the PubSub emulator is properly initialized.`);
        }
    });

    it('should successfully publish a message to Pub/Sub', async () => {
        const messageId = await publishEvent({
            topic: testTopic,
            payload: testPayload,
            logger: mockLogger
        });

        expect(messageId).toBeDefined();
        expect(typeof messageId).toBe('string');
        expect(messageId.length).toBeGreaterThan(0);
    });

    it('should publish messages with correct data format', async () => {
        // Create a unique subscription to verify the message content
        const subscriptionName = `test-subscription-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        let subscription: any;
        
        try {
            // Create subscription
            [subscription] = await pubsub.topic(testTopic).createSubscription(subscriptionName);
            
            // Set up message handler
            const receivedMessages: any[] = [];
            const messageHandler = (message: any) => {
                const data = JSON.parse(message.data.toString());
                receivedMessages.push(data);
                message.ack();
            };

            subscription.on('message', messageHandler);

            // Publish the message
            await publishEvent({
                topic: testTopic,
                payload: testPayload,
                logger: mockLogger
            });

            // Wait for message to be received
            await new Promise<void>((resolve) => {
                setTimeout(() => resolve(), 1000);
            });

            // Verify message content
            expect(receivedMessages.length).toBeGreaterThan(0);
            expect(receivedMessages[0]).toEqual(testPayload);

            // Clean up subscription
            subscription.removeListener('message', messageHandler);
            await subscription.close();
        } finally {
            // Ensure subscription cleanup even if test fails
            if (subscription) {
                try {
                    await subscription.delete();
                } catch (error) {
                    // Ignore cleanup errors
                }
            }
        }
    });

    it('should throw error for non-existent topic', async () => {
        const nonExistentTopic = 'non-existent-topic-12345';

        await expect(
            publishEvent({
                topic: nonExistentTopic,
                payload: testPayload,
                logger: mockLogger
            })
        ).rejects.toThrow();
    });
});