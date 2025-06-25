import {describe, it, expect, beforeEach, vi, afterEach} from 'vitest';
import {Message} from '@google-cloud/pubsub';
import BatchWorker from '../../../../src/services/batch-worker/BatchWorker';
import {EventSubscriber} from '../../../../src/services/events/subscriber';
import {TinybirdClient} from '../../../../src/services/tinybird/client';
import logger from '../../../../src/utils/logger';

// Mock EventSubscriber
vi.mock('../../../../src/services/events/subscriber', () => ({
    EventSubscriber: vi.fn().mockImplementation(() => ({
        subscribe: vi.fn(),
        close: vi.fn()
    }))
}));

// Mock TinybirdClient
vi.mock('../../../../src/services/tinybird/client', () => ({
    TinybirdClient: vi.fn().mockImplementation(() => ({
        postEvent: vi.fn().mockResolvedValue(undefined)
    }))
}));

const createMockMessage = (data: string) => {
    return {
        data: Buffer.from(data),
        ack: vi.fn(),
        nack: vi.fn()
    } as unknown as Message;
};

describe('BatchWorker', () => {
    let batchWorker: BatchWorker;
    let mockSubscriber: EventSubscriber;
    let mockTinybirdClient: TinybirdClient;
    const testTopic = 'test-topic';

    beforeEach(() => {
        vi.clearAllMocks();
        // Mock logger methods to avoid noise in tests
        vi.spyOn(logger, 'info').mockImplementation(() => {});
        vi.spyOn(logger, 'error').mockImplementation(() => {});

        mockTinybirdClient = new TinybirdClient({
            apiUrl: 'https://api.tinybird.co',
            apiToken: 'test-token',
            datasource: 'test-datasource'
        });

        batchWorker = new BatchWorker(testTopic, mockTinybirdClient);
        mockSubscriber = (batchWorker as any).subscriber;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create an instance with the provided topic', () => {
            expect(batchWorker).toBeInstanceOf(BatchWorker);
            expect(EventSubscriber).toHaveBeenCalledWith(testTopic);
            expect(logger.info).toHaveBeenCalledWith('Creating batch worker for topic: %s', testTopic);
        });
    });

    describe('start', () => {
        it('should start the subscriber with handleMessage callback', async () => {
            await batchWorker.start();

            expect(logger.info).toHaveBeenCalledWith('Starting batch worker for topic: %s', testTopic);
            expect(mockSubscriber.subscribe).toHaveBeenCalledWith(expect.any(Function));
        });
    });

    describe('stop', () => {
        it('should stop the subscriber', async () => {
            await batchWorker.stop();

            expect(logger.info).toHaveBeenCalledWith('Stopping batch worker for topic: %s', testTopic);
            expect(mockSubscriber.close).toHaveBeenCalled();
        });
    });

    describe('handleMessage', () => {
        const validPageHitRawData = {
            timestamp: '2024-01-01T12:00:00.000Z',
            action: 'page_hit',
            version: '1',
            site_uuid: '550e8400-e29b-41d4-a716-446655440000',
            payload: {
                member_uuid: 'undefined',
                member_status: 'undefined',
                post_uuid: 'undefined',
                post_type: 'null',
                locale: 'en-US',
                location: 'New York',
                referrer: 'https://example.com',
                pathname: '/blog/post',
                href: 'https://mysite.com/blog/post'
            },
            meta: {
                ip: '192.168.1.1',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
            }
        };
        const expectMessageAcked = (message: Message) => {
            expect(message.ack).toHaveBeenCalled();
            expect(message.nack).not.toHaveBeenCalled();
        };

        const expectMessageNacked = (message: Message) => {
            expect(message.nack).toHaveBeenCalled();
            expect(message.ack).not.toHaveBeenCalled();
        };

        it('should process valid message and ack', async () => {
            const mockMessage = createMockMessage(JSON.stringify(validPageHitRawData));

            await (batchWorker as any).handleMessage(mockMessage);

            expectMessageAcked(mockMessage);
        });

        it('should transform pageHitRaw to pageHitProcessed and log processed data', async () => {
            const mockMessage = createMockMessage(JSON.stringify(validPageHitRawData));

            await (batchWorker as any).handleMessage(mockMessage);

            // Verify the logger was called with processed data (not raw data)
            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    pageHitProcessed: expect.objectContaining({
                        timestamp: validPageHitRawData.timestamp,
                        action: validPageHitRawData.action,
                        version: validPageHitRawData.version,
                        site_uuid: validPageHitRawData.site_uuid,
                        session_id: expect.any(String),
                        payload: expect.objectContaining({
                            // Original payload fields
                            member_uuid: validPageHitRawData.payload.member_uuid,
                            member_status: validPageHitRawData.payload.member_status,
                            post_uuid: validPageHitRawData.payload.post_uuid,
                            post_type: validPageHitRawData.payload.post_type,
                            locale: validPageHitRawData.payload.locale,
                            location: validPageHitRawData.payload.location,
                            referrer: validPageHitRawData.payload.referrer,
                            pathname: validPageHitRawData.payload.pathname,
                            href: validPageHitRawData.payload.href,
                            // Processed fields
                            os: expect.any(String),
                            browser: expect.any(String),
                            device: expect.any(String)
                        })
                    })
                }),
                'Worker processed message and posted to Tinybird. Acknowledging message...'
            );
            
            // Verify meta field is not included in processed output
            const logCall = (logger.info as any).mock.calls.find((call: any) => call[1] === 'Worker processed message and posted to Tinybird. Acknowledging message...');
            expect(logCall[0].pageHitProcessed).not.toHaveProperty('meta');
            
            expectMessageAcked(mockMessage);
        });

        it('should call TinybirdClient.postEvent with processed data', async () => {
            const mockMessage = createMockMessage(JSON.stringify(validPageHitRawData));

            await (batchWorker as any).handleMessage(mockMessage);

            expect(mockTinybirdClient.postEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    timestamp: validPageHitRawData.timestamp,
                    action: validPageHitRawData.action,
                    version: validPageHitRawData.version,
                    site_uuid: validPageHitRawData.site_uuid,
                    session_id: expect.any(String),
                    payload: expect.objectContaining({
                        member_uuid: validPageHitRawData.payload.member_uuid,
                        member_status: validPageHitRawData.payload.member_status,
                        post_uuid: validPageHitRawData.payload.post_uuid,
                        post_type: validPageHitRawData.payload.post_type,
                        locale: validPageHitRawData.payload.locale,
                        location: validPageHitRawData.payload.location,
                        referrer: validPageHitRawData.payload.referrer,
                        pathname: validPageHitRawData.payload.pathname,
                        href: validPageHitRawData.payload.href,
                        os: expect.any(String),
                        browser: expect.any(String),
                        device: expect.any(String)
                    })
                })
            );
            expectMessageAcked(mockMessage);
        });

        it('should handle TinybirdClient error and nack message', async () => {
            const mockMessage = createMockMessage(JSON.stringify(validPageHitRawData));
            const tinybirdError = new Error('Tinybird API error');
            
            (mockTinybirdClient.postEvent as any).mockRejectedValueOnce(tinybirdError);

            await expect((batchWorker as any).handleMessage(mockMessage)).rejects.toThrow('Tinybird API error');

            expectMessageNacked(mockMessage);
        });

        it('should handle invalid JSON and nack message', async () => {
            const invalidJson = 'invalid json';
            const mockMessage = createMockMessage(invalidJson);

            await expect((batchWorker as any).handleMessage(mockMessage)).rejects.toThrow();

            expectMessageNacked(mockMessage);
        });

        it('should handle invalid schema and nack message', async () => {
            const invalidData = {
                timestamp: 'invalid-timestamp',
                action: 'invalid-action',
                version: '2'
            };
            const mockMessage = createMockMessage(JSON.stringify(invalidData));

            await expect((batchWorker as any).handleMessage(mockMessage)).rejects.toThrow();

            expectMessageNacked(mockMessage);
        });

        it('should handle missing required fields and nack message', async () => {
            const incompleteData = {
                timestamp: '2024-01-01T12:00:00.000Z',
                action: 'page_hit'
                // Missing required fields
            };
            const mockMessage = createMockMessage(JSON.stringify(incompleteData));

            await expect((batchWorker as any).handleMessage(mockMessage)).rejects.toThrow();

            expectMessageNacked(mockMessage);
        });

        it('should handle empty message data', async () => {
            const mockMessage = createMockMessage('');

            await expect((batchWorker as any).handleMessage(mockMessage)).rejects.toThrow();

            expectMessageNacked(mockMessage);
        });

        it('should handle valid message with null values in payload', async () => {
            const dataWithNulls = {
                ...validPageHitRawData,
                payload: {
                    ...validPageHitRawData.payload,
                    location: null,
                    referrer: null
                }
            };
            const mockMessage = createMockMessage(JSON.stringify(dataWithNulls));

            await (batchWorker as any).handleMessage(mockMessage);

            expectMessageAcked(mockMessage);
        });

        it('should handle valid message with different post types', async () => {
            const testCases = ['null', 'post', 'page'];
            
            for (const postType of testCases) {
                const dataWithPostType = {
                    ...validPageHitRawData,
                    payload: {
                        ...validPageHitRawData.payload,
                        post_type: postType
                    }
                };
                const mockMessage = createMockMessage(JSON.stringify(dataWithPostType));

                await (batchWorker as any).handleMessage(mockMessage);

                expectMessageAcked(mockMessage);
            }
        });

        it('should handle invalid UUID formats', async () => {
            const invalidUuidData = {
                ...validPageHitRawData,
                site_uuid: 'invalid-uuid'
            };
            const mockMessage = createMockMessage(JSON.stringify(invalidUuidData));

            await expect((batchWorker as any).handleMessage(mockMessage)).rejects.toThrow();

            expectMessageNacked(mockMessage);
        });

        it('should handle invalid URL format in href', async () => {
            const invalidUrlData = {
                ...validPageHitRawData,
                payload: {
                    ...validPageHitRawData.payload,
                    href: 'not-a-url'
                }
            };
            const mockMessage = createMockMessage(JSON.stringify(invalidUrlData));

            await expect((batchWorker as any).handleMessage(mockMessage)).rejects.toThrow();

            expectMessageNacked(mockMessage);
        });
    });
});