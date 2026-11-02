import {activePublishes} from '../../../../src/utils/active-operations';
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

    it('tracks a pending publish and removes it on rejection', async () => {
        let reject!: (error: Error) => void;
        mocks.publishMessage.mockImplementationOnce(() => new Promise((_resolve, rejectPromise) => {
            reject = rejectPromise;
        }));
        const pending = publishEvent({topic: 'pending-test', payload: {}, logger: createMockLogger()});
        expect(activePublishes.snapshot().count).toBe(1);
        const failed = expect(pending).rejects.toThrow('unavailable');
        reject(new Error('unavailable'));
        await failed;
        expect(activePublishes.snapshot()).toEqual({count: 0, oldestAgeMs: 0});
    });

    it('reuses the Topic publisher for events sent to the same topic', async () => {
        const logger = createMockLogger();

        await publishEvent({topic: 'tinybird-sync', payload: {id: 'one'}, logger});
        await publishEvent({topic: 'tinybird-sync', payload: {id: 'two'}, logger});
        await publishEvent({topic: 'page-hits', payload: {id: 'three'}, logger});

        expect(mocks.topic).toHaveBeenCalledTimes(2);
        expect(mocks.topic.mock.calls.map(([name]) => name)).toEqual(['tinybird-sync', 'page-hits']);
        expect(mocks.topic).toHaveBeenCalledWith('tinybird-sync', {
            batching: {
                maxMessages: 1000
            }
        });
        expect(mocks.publishMessage).toHaveBeenCalledTimes(3);
        expect(activePublishes.snapshot().count).toBe(0);
    });
});
