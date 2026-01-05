import {describe, it, expect, vi, beforeEach} from 'vitest';
import {publishPageHitRaw} from '../../../../src/services/events/publisherUtils';
import {PageHitRequestType} from '../../../../src/schemas';
import * as publisherModule from '../../../../src/services/events/publisher';
import * as transformationsModule from '../../../../src/transformations/page-hit-transformations';

vi.mock('../../../../src/services/events/publisher', () => ({
    publishEvent: vi.fn()
}));

vi.mock('../../../../src/transformations/page-hit-transformations', () => ({
    pageHitRawPayloadFromRequest: vi.fn()
}));

describe('publisherUtils', () => {
    let mockRequest: PageHitRequestType;

    beforeEach(() => {
        vi.clearAllMocks();

        mockRequest = {
            log: {
                info: vi.fn(),
                error: vi.fn()
            }
        } as unknown as PageHitRequestType;

        process.env.PUBSUB_TOPIC_PAGE_HITS_RAW = 'test-topic';
    });

    describe('publishPageHitRaw', () => {
        it('should log info message with only event_id on successful publish', async () => {
            const mockPayload = {
                payload: {
                    event_id: 'test-event-123',
                    sensitive: 'data'
                },
                other: 'info'
            };
            vi.spyOn(transformationsModule, 'pageHitRawPayloadFromRequest').mockReturnValue(mockPayload as any);
            vi.spyOn(publisherModule, 'publishEvent').mockResolvedValue('message-id');

            await publishPageHitRaw(mockRequest);

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
            const mockPayload = {payload: {event_id: 'test-123'}};
            vi.spyOn(transformationsModule, 'pageHitRawPayloadFromRequest').mockReturnValue(mockPayload as any);
            vi.spyOn(publisherModule, 'publishEvent').mockResolvedValue('message-id');

            await publishPageHitRaw(mockRequest);

            expect(mockRequest.log.error).not.toHaveBeenCalled();
        });

        it('should call publishEvent with correct parameters', async () => {
            const mockPayload = {payload: {event_id: 'test-123'}};
            vi.spyOn(transformationsModule, 'pageHitRawPayloadFromRequest').mockReturnValue(mockPayload as any);
            const publishEventSpy = vi.spyOn(publisherModule, 'publishEvent').mockResolvedValue('message-id');

            await publishPageHitRaw(mockRequest);

            expect(publishEventSpy).toHaveBeenCalledWith({
                topic: 'test-topic',
                payload: mockPayload,
                logger: mockRequest.log
            });
        });

        it('should not publish when PUBSUB_TOPIC_PAGE_HITS_RAW is not set', async () => {
            delete process.env.PUBSUB_TOPIC_PAGE_HITS_RAW;
            const publishEventSpy = vi.spyOn(publisherModule, 'publishEvent');

            await publishPageHitRaw(mockRequest);

            expect(publishEventSpy).not.toHaveBeenCalled();
            expect(mockRequest.log.info).not.toHaveBeenCalled();
        });
    });
});
