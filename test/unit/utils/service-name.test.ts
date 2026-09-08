import {describe, expect, it} from 'vitest';
import {getDefaultServiceName} from '../../../src/utils/service-name';

describe('getDefaultServiceName', () => {
    it.each([
        ['true', 'analytics-worker'],
        ['tinybird-sync', 'analytics-tinybird-sync-worker'],
        ['false', 'analytics-service'],
        ['', 'analytics-service'],
        ['unknown', 'analytics-service']
    ])('maps WORKER_MODE=%j to %s', (workerMode, expectedServiceName) => {
        expect(getDefaultServiceName(workerMode)).toBe(expectedServiceName);
    });
});
