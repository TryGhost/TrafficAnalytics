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
        // Initialize topic name
        testTopic = process.env.PUBSUB_TOPIC_PAGE_HITS_RAW || 'traffic-analytics-page-hits-raw';
        
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
            projectId: process.env.GOOGLE_CLOUD_PROJECT || 'traffic-analytics-dev'
        });

        // Note: Using existing topic created by the emulator setup
        // No need to create/delete topic as it's managed by the emulator
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
        // Create a subscription to verify the message content
        const subscriptionName = `test-publisher-subscription-${Date.now()}`;
        
        try {
            await pubsub.topic(testTopic).createSubscription(subscriptionName);
        } catch (error: any) {
            // Subscription might already exist
            if (error.code !== 6) {
                throw error;
            }
        }

        const subscription = pubsub.subscription(subscriptionName);
        
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
        await subscription.delete();
    });

    it('should handle publishing multiple messages', async () => {
        const messages = [
            {action: 'page_hit', id: 1},
            {action: 'page_hit', id: 2},
            {action: 'page_hit', id: 3}
        ];

        const messageIds = await Promise.all(
            messages.map(payload => publishEvent({topic: testTopic, payload, logger: mockLogger})
            )
        );

        expect(messageIds).toHaveLength(3);
        messageIds.forEach((id) => {
            expect(typeof id).toBe('string');
            expect(id.length).toBeGreaterThan(0);
        });

        // All message IDs should be unique
        const uniqueIds = new Set(messageIds);
        expect(uniqueIds.size).toBe(3);
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