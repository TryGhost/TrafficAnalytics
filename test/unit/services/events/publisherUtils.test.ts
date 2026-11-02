import {describe, it, expect, vi, beforeEach} from 'vitest';
import {publishPageHitRaw, publishTinybirdSyncEvent} from '../../../../src/services/events/publisherUtils';
import {PageHitRaw, PageHitRequestType, type TinybirdSyncEvent} from '../../../../src/schemas';
import * as publisherModule from '../../../../src/services/events/publisher';

vi.mock('../../../../src/services/events/publisher', () => ({
    publishEvent: vi.fn()
}));

describe('publisherUtils', () => {
    let mockRequest: PageHitRequestType;
    let mockPayload: PageHitRaw;

    beforeEach(() => {
        vi.clearAllMocks();

        mockRequest = {
            log: {
                info: vi.fn(),
                debug: vi.fn(),
                error: vi.fn()
            }
        } as unknown as PageHitRequestType;

        mockPayload = {
            payload: {
                event_id: 'test-event-123'
            }
        } as unknown as PageHitRaw;

        process.env.PUBSUB_TOPIC_PAGE_HITS_RAW = 'test-topic';
    });

    describe('publishPageHitRaw', () => {
        it('should log debug payload details on successful publish', async () => {
            const payload = {
                payload: {
                    event_id: 'test-event-123',
                    sensitive: 'data'
                },
                other: 'info'
            } as unknown as PageHitRaw;
            vi.spyOn(publisherModule, 'publishEvent').mockResolvedValue('message-id');

            await publishPageHitRaw(mockRequest, payload);

            expect(mockRequest.log.debug).toHaveBeenCalledWith(
                {
                    event: 'PublishingPageHitRawEvent',
                    event_id: 'test-event-123',
                    payload
                }
            );
        });

        it('should log publish duration on success', async () => {
            const now = vi.spyOn(performance, 'now').mockReturnValue(100);
            vi.spyOn(publisherModule, 'publishEvent').mockImplementation(async () => {
                now.mockReturnValue(125.5);
                return 'message-id';
            });

            await publishPageHitRaw(mockRequest, mockPayload);

            expect(mockRequest.log.info).toHaveBeenCalledWith({
                event: 'PublishedPageHitRawEvent',
                message_id: 'message-id',
                event_id: 'test-event-123',
                durationMs: 25.5
            });
            expect(mockRequest.log.error).not.toHaveBeenCalled();
        });

        it('should call publishEvent with correct parameters', async () => {
            const publishEventSpy = vi.spyOn(publisherModule, 'publishEvent').mockResolvedValue('message-id');

            await publishPageHitRaw(mockRequest, mockPayload);

            expect(publishEventSpy).toHaveBeenCalledWith({
                topic: 'test-topic',
                payload: mockPayload,
                logger: mockRequest.log
            });
        });

        it('should not publish when PUBSUB_TOPIC_PAGE_HITS_RAW is not set', async () => {
            delete process.env.PUBSUB_TOPIC_PAGE_HITS_RAW;
            const publishEventSpy = vi.spyOn(publisherModule, 'publishEvent');

            await publishPageHitRaw(mockRequest, mockPayload);

            expect(publishEventSpy).not.toHaveBeenCalled();
            expect(mockRequest.log.info).not.toHaveBeenCalled();
        });
    });

    describe('publishTinybirdSyncEvent', () => {
        it('should publish the complete event to the configured topic', async () => {
            process.env.PUBSUB_TOPIC_TINYBIRD_SYNC = 'tinybird-sync-topic';
            const payload: TinybirdSyncEvent = {
                type: 'automation_runs',
                site_uuid: '45d99892-6304-4251-a75d-2d9ff9c5b81f',
                id: '6a99cd8cb5ac7c0052553383',
                updated_at: '2026-09-03T19:42:04.000Z',
                payload: {
                    id: '6a99cd8cb5ac7c0052553383',
                    automation_id: '6a99cd6cb5ac7c0052553378',
                    created_at: '2026-09-03T19:42:04.000Z',
                    updated_at: '2026-09-03T19:42:04.000Z',
                    site_uuid: '45d99892-6304-4251-a75d-2d9ff9c5b81f'
                }
            };
            const now = vi.spyOn(performance, 'now').mockReturnValue(200);
            const publishEventSpy = vi.spyOn(publisherModule, 'publishEvent').mockImplementation(async () => {
                now.mockReturnValue(212.5);
                return 'sync-message-id';
            });

            await publishTinybirdSyncEvent(mockRequest, payload);

            expect(mockRequest.log.info).toHaveBeenCalledWith({
                event: 'PublishedTinybirdSyncEvent',
                message_id: 'sync-message-id',
                tinybird_sync_event_id: payload.id,
                tinybird_sync_event_type: payload.type,
                durationMs: 12.5
            });

            expect(publishEventSpy).toHaveBeenCalledWith({
                topic: 'tinybird-sync-topic',
                payload,
                logger: mockRequest.log
            });
        });
    });
});
