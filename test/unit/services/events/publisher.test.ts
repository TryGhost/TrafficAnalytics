import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createMockLogger} from '../../../utils/mock-logger';
import {publishEvent} from '../../../../src/services/events/publisher';

const mocks = vi.hoisted(() => ({
    publishMessage: vi.fn(),
    topic: vi.fn()
}));

vi.mock('@google-cloud/pubsub', () => {
    class PubSub {
        topic = mocks.topic;
    }

    return {PubSub};
});

describe('event publisher', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.publishMessage.mockResolvedValue('message-id');
        mocks.topic.mockReturnValue({publishMessage: mocks.publishMessage});
    });

    it('reuses the Topic publisher for events sent to the same topic', async () => {
        const logger = createMockLogger();

        await publishEvent({topic: 'automation-events', payload: {id: 'one'}, logger});
        await publishEvent({topic: 'automation-events', payload: {id: 'two'}, logger});
        await publishEvent({topic: 'page-hits', payload: {id: 'three'}, logger});

        expect(mocks.topic).toHaveBeenCalledTimes(2);
        expect(mocks.topic).toHaveBeenNthCalledWith(1, 'automation-events');
        expect(mocks.topic).toHaveBeenNthCalledWith(2, 'page-hits');
        expect(mocks.publishMessage).toHaveBeenCalledTimes(3);
    });
});
