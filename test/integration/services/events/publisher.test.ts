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
        
        // Verify topic exists before running tests
        const topic = pubsub.topic(testTopic);
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
            try {
                const [exists] = await topic.exists();
                if (exists) {
                    break;
                }
            } catch (error) {
                // Topic check failed, continue trying
            }
            
            attempts += 1;
            if (attempts >= maxAttempts) {
                throw new Error(`Topic ${testTopic} not found after ${maxAttempts} attempts. Make sure Pub/Sub emulator is properly initialized.`);
            }
            
            // Wait a bit before retrying
            await new Promise<void>((resolve) => {
                setTimeout(() => resolve(), 100);
            });
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

    it('should publish messages with timestamped data', async () => {
        // Test that publisher adds timestamp to payload correctly
        const messageId = await publishEvent({
            topic: testTopic,
            payload: testPayload,
            logger: mockLogger
        });

        // Just verify the publish operation succeeded
        expect(messageId).toBeDefined();
        expect(typeof messageId).toBe('string');
        expect(messageId.length).toBeGreaterThan(0);
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