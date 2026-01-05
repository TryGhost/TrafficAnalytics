import {describe, it, expect, vi, beforeEach} from 'vitest';
import {publishPageHitRaw} from '../../../../src/services/events/publisherUtils';
import {PageHitRaw, PageHitRequestType} from '../../../../src/schemas';
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
        it('should log info message with only event_id on successful publish', async () => {
            const payload = {
                payload: {
                    event_id: 'test-event-123',
                    sensitive: 'data'
                },
                other: 'info'
            } as unknown as PageHitRaw;
            vi.spyOn(publisherModule, 'publishEvent').mockResolvedValue('message-id');

            await publishPageHitRaw(mockRequest, payload);

            expect(mockRequest.log.info).toHaveBeenCalledWith(
                {event_id: 'test-event-123'},
                'Publishing page hit raw event'
            );
            expect(mockRequest.log.info).not.toHaveBeenCalledWith(
                expect.objectContaining({payload: expect.anything()}),
                expect.anything()
            );
        });

        it('should not log error on successful publish', async () => {
            vi.spyOn(publisherModule, 'publishEvent').mockResolvedValue('message-id');

            await publishPageHitRaw(mockRequest, mockPayload);

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
});
