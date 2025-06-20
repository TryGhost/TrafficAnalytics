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
});