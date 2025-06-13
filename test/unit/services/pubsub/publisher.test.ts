import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {publishEvent, setPubSubClient} from '../../../../src/services/pubsub/publisher';

// Mock @google-cloud/pubsub
const mockPublishMessage = vi.fn();
const mockTopic = vi.fn(() => ({
    publishMessage: mockPublishMessage
}));
const mockPubSubClient = {
    topic: mockTopic
};

vi.mock('@google-cloud/pubsub', () => ({
    PubSub: vi.fn(() => mockPubSubClient)
}));

describe('PubSub Publisher', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setPubSubClient(null); // Reset client
        mockPublishMessage.mockResolvedValue(undefined);
    });

    afterEach(() => {
        setPubSubClient(null); // Clean up
    });

    describe('publishEvent', () => {
        const topicName = 'test-topic';
        const payload = {
            body: {action: 'page_hit', session_id: 'test-123'},
            query: {token: 'abc'},
            headers: {'user-agent': 'test-browser'},
            ip: '192.168.1.1'
        };

        it('should publish event successfully on first attempt', async () => {
            await publishEvent(topicName, payload);

            expect(mockTopic).toHaveBeenCalledWith(topicName);
            expect(mockPublishMessage).toHaveBeenCalledOnce();
            expect(mockPublishMessage).toHaveBeenCalledWith({
                data: Buffer.from(JSON.stringify(payload))
            });
        });

        it('should retry once on failure and succeed', async () => {
            mockPublishMessage
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce(undefined);

            await publishEvent(topicName, payload);

            expect(mockPublishMessage).toHaveBeenCalledTimes(2);
            expect(mockPublishMessage).toHaveBeenCalledWith({
                data: Buffer.from(JSON.stringify(payload))
            });
        });

        it('should throw error when both attempts fail', async () => {
            const error1 = new Error('Network error');
            const error2 = new Error('Still failing');
            
            mockPublishMessage
                .mockRejectedValueOnce(error1)
                .mockRejectedValueOnce(error2);

            await expect(publishEvent(topicName, payload)).rejects.toThrow('Still failing');
            expect(mockPublishMessage).toHaveBeenCalledTimes(2);
        });

        it('should handle complex payload data correctly', async () => {
            const complexPayload = {
                nested: {
                    data: ['array', 'values'],
                    number: 42,
                    boolean: true
                },
                timestamp: '2025-01-06T20:00:00.000Z'
            };

            await publishEvent(topicName, complexPayload);

            expect(mockPublishMessage).toHaveBeenCalledWith({
                data: Buffer.from(JSON.stringify(complexPayload))
            });
        });
    });
});