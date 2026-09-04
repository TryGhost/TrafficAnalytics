import {describe, it, expect, vi, beforeEach} from 'vitest';
import type {FastifyRequest} from 'fastify';
import {publishAutomationEvent, publishPageHitRaw} from '../../../../src/services/events/publisherUtils';
import {type AutomationEvent, PageHitRaw, PageHitRequestType} from '../../../../src/schemas';
import * as publisherModule from '../../../../src/services/events/publisher';

vi.mock('../../../../src/services/events/publisher', () => ({
    publishEvent: vi.fn()
}));

describe('publisherUtils', () => {
    let mockRequest: PageHitRequestType;
    let mockPayload: PageHitRaw;
    let mockAutomationEvent: AutomationEvent;

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
        process.env.PUBSUB_TOPIC_AUTOMATION_EVENTS = 'test-automation-topic';

        mockAutomationEvent = {
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
    });

    describe('publishAutomationEvent', () => {
        it('publishes the complete automation event to its configured topic', async () => {
            const publishEventSpy = vi.spyOn(publisherModule, 'publishEvent').mockResolvedValue('automation-message-id');

            await publishAutomationEvent(mockRequest as unknown as FastifyRequest, mockAutomationEvent);

            expect(publishEventSpy).toHaveBeenCalledWith({
                topic: 'test-automation-topic',
                payload: mockAutomationEvent,
                logger: mockRequest.log
            });
            expect(mockRequest.log.info).toHaveBeenCalledWith({
                event: 'PublishedAutomationEvent',
                message_id: 'automation-message-id',
                automation_event_id: mockAutomationEvent.id,
                automation_event_type: mockAutomationEvent.type
            });
        });

        it('does not publish when PUBSUB_TOPIC_AUTOMATION_EVENTS is not set', async () => {
            delete process.env.PUBSUB_TOPIC_AUTOMATION_EVENTS;
            const publishEventSpy = vi.spyOn(publisherModule, 'publishEvent');

            await publishAutomationEvent(mockRequest as unknown as FastifyRequest, mockAutomationEvent);

            expect(publishEventSpy).not.toHaveBeenCalled();
        });
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
