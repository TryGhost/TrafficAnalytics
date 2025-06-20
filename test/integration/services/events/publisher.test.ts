import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {publishEvent} from '../../../../src/services/events/publisher.js';
import {createMockLogger} from '../../../utils/mock-logger.js';
import {createTopic, deleteTopic} from '../../../utils/pubsub.js';

describe('Publisher Integration Tests', () => {
    let testTopic: string;
    let testPayload: Record<string, unknown>;
    let mockLogger: ReturnType<typeof createMockLogger>;

    beforeAll(async () => {
        // Use the same topic as the application for consistency
        testTopic = process.env.PUBSUB_TOPIC_PAGE_HITS_RAW || 'test-traffic-analytics-page-hits-raw';
        await createTopic(testTopic);

        // Initialize mock logger
        mockLogger = createMockLogger();

        // Initialize test payload
        testPayload = {
            action: 'page_hit',
            timestamp: new Date().toISOString(),
            data: {
                url: 'https://example.com',
                user_agent: 'test-agent'
            }
        };
    });

    afterAll(async function () {
        await deleteTopic(testTopic);
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