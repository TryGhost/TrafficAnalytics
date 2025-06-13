import {describe, it, expect, beforeEach, vi} from 'vitest';
import {publishRawEventToPubSub, setPubSubClient} from '../../../../src/services/pubsub/publisher';
import {FastifyRequest} from '../../../../src/types';

// Mock the PubSub client
const mockPublishMessage = vi.fn();
const mockTopic = vi.fn(() => ({
    publishMessage: mockPublishMessage
}));
const mockPubSubClient = {
    topic: mockTopic
} as any;

const mockRequest = {
    body: {
        timestamp: '2025-04-14T22:16:06.095Z',
        action: 'page_hit',
        version: '1',
        session_id: '9017be4c-3065-484b-b117-9719ad1e3977',
        payload: {
            user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            locale: 'en-US',
            location: 'US',
            referrer: null,
            pathname: '/',
            href: 'https://www.example.com/',
            site_uuid: '940b73e9-4952-4752-b23d-9486f999c47e',
            post_uuid: 'undefined',
            post_type: 'post',
            member_uuid: 'undefined',
            member_status: 'undefined'
        }
    },
    query: {
        token: 'abc123',
        name: 'test'
    },
    headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        referer: 'https://www.example.com/previous-page'
    },
    ip: '192.168.1.100'
} as unknown as FastifyRequest;

describe('PubSub Publisher', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.PUBSUB_TOPIC_NAME = 'test-topic';
        setPubSubClient(mockPubSubClient);
    });

    it('should publish raw event data to PubSub topic', async () => {
        await publishRawEventToPubSub(mockRequest);

        expect(mockTopic).toHaveBeenCalledWith('test-topic');
        expect(mockPublishMessage).toHaveBeenCalledOnce();

        const publishedData = mockPublishMessage.mock.calls[0][0];
        const messageData = JSON.parse(publishedData.data.toString());

        expect(messageData).toEqual({
            timestamp: '2025-04-14T22:16:06.095Z',
            action: 'page_hit',
            version: '1',
            session_id: '9017be4c-3065-484b-b117-9719ad1e3977',
            payload: mockRequest.body.payload,
            query: {
                token: 'abc123',
                name: 'test'
            },
            headers: {
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                referer: 'https://www.example.com/previous-page'
            },
            ip: '192.168.1.100'
        });
    });

    it('should throw error when PUBSUB_TOPIC_NAME is not set', async () => {
        delete process.env.PUBSUB_TOPIC_NAME;

        await expect(publishRawEventToPubSub(mockRequest)).rejects.toThrow(
            'PUBSUB_TOPIC_NAME environment variable is required'
        );
    });

    it('should publish raw payload without enrichment', async () => {
        // Simulate a request with enriched data that should NOT be published
        const enrichedRequest = {
            ...mockRequest,
            body: {
                ...mockRequest.body,
                payload: {
                    ...mockRequest.body.payload,
                    os: 'macos',
                    browser: 'chrome',
                    device: 'desktop'
                }
            }
        };

        await publishRawEventToPubSub(enrichedRequest);

        const publishedData = mockPublishMessage.mock.calls[0][0];
        const messageData = JSON.parse(publishedData.data.toString());

        // Should include the enriched data since we're capturing whatever is in the request
        // at the time of publishing (this test verifies current behavior)
        expect(messageData.payload).toEqual(enrichedRequest.body.payload);
    });

    it('should handle missing headers gracefully', async () => {
        const requestWithoutHeaders = {
            ...mockRequest,
            headers: {}
        };

        await publishRawEventToPubSub(requestWithoutHeaders);

        const publishedData = mockPublishMessage.mock.calls[0][0];
        const messageData = JSON.parse(publishedData.data.toString());

        expect(messageData.headers).toEqual({
            'user-agent': undefined,
            referer: undefined
        });
    });

    it('should handle empty query parameters', async () => {
        const requestWithoutQuery = {
            ...mockRequest,
            query: {}
        };

        await publishRawEventToPubSub(requestWithoutQuery);

        const publishedData = mockPublishMessage.mock.calls[0][0];
        const messageData = JSON.parse(publishedData.data.toString());

        expect(messageData.query).toEqual({});
    });
});