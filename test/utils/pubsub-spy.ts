import {vi, expect} from 'vitest';

/**
 * Creates a PubSub spy that can be used to spy on the PubSub client.
 * 
 * Usage:
 * ```ts
 * const pubSubSpy = createPubSubSpy();
 * EventPublisher.resetInstance(pubSubSpy.mockPubSub as any);
 * 
 * const response = await app.inject({
 *     method: 'POST',
 *     url: '/tb/web_analytics',
 *     query: fixtures.queryParams.defaultValidRequestQuery,
 *     headers: fixtures.headers.defaultValidRequestHeaders,
 *     body: fixtures.pageHits.defaultValidRequestBody
 * });
 * 
 * // You can use withMessage for low-level assertions:
 * pubSubSpy.expectPublishedMessageToTopic(pubsubTopic).withMessage({
 *     data: expect.any(Buffer),
 *     timestamp: expect.any(String)
 * });
 * 
 * // Or use withMessageData to assert on the parsed data:
 * pubSubSpy.expectPublishedMessageToTopic(pubsubTopic).withMessageData({
 *     site_uuid: 'test-site-uuid',
 *     page_hits: expect.any(Array)
 * });
 * ```
 * @returns 
 */
export const createPubSubSpy = () => {
    // Realistic mock message ID (15-digit number as string)
    const DEFAULT_MESSAGE_ID = '384950293840593';
    
    const publishMessageSpy = vi.fn().mockResolvedValue(DEFAULT_MESSAGE_ID);
    const topicSpy = vi.fn();
    
    const mockPubSub = {
        topic: topicSpy.mockImplementation(() => ({
            publishMessage: publishMessageSpy
        }))
    };
    
    const expectPublishedMessageToTopic = (expectedTopic: string) => {
        return {
            withMessageData: (expectedData: any) => {
                expect(topicSpy).toHaveBeenCalledWith(expectedTopic);
                
                // Get the actual call arguments
                const calls = publishMessageSpy.mock.calls;
                expect(calls.length).toBeGreaterThan(0);
                
                const actualMessage = calls[calls.length - 1][0];
                
                // Parse the buffer data if it exists
                if (actualMessage.data && Buffer.isBuffer(actualMessage.data)) {
                    const parsedData = JSON.parse(actualMessage.data.toString());
                    expect(parsedData).toEqual(expectedData);
                } else {
                    // Fallback to direct comparison if not a buffer
                    expect(actualMessage).toEqual(expectedData);
                }
                
                // Also check timestamp exists
                expect(actualMessage).toHaveProperty('timestamp');
                expect(typeof actualMessage.timestamp).toBe('string');
            },
            withMessage: (messageMatcher: any) => {
                expect(topicSpy).toHaveBeenCalledWith(expectedTopic);
                expect(publishMessageSpy).toHaveBeenCalledWith(messageMatcher);
            }
        };
    };
    
    const expectNoMessagesPublished = () => {
        expect(publishMessageSpy).not.toHaveBeenCalled();
        expect(topicSpy).not.toHaveBeenCalled();
    };
    
    const clearSpies = () => {
        publishMessageSpy.mockClear();
        topicSpy.mockClear();
    };
    
    const setMockMessageId = (messageId: string) => {
        publishMessageSpy.mockResolvedValue(messageId);
    };
    
    return {
        mockPubSub,
        publishMessageSpy,
        topicSpy,
        expectPublishedMessageToTopic,
        expectNoMessagesPublished,
        clearSpies,
        setMockMessageId
    };
};