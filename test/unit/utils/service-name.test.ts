import {describe, expect, it} from 'vitest';
import {getDefaultServiceName} from '../../../src/utils/service-name';

describe('getDefaultServiceName', () => {
    it('maps true to batch worker', () => {
        expect(getDefaultServiceName('true')).toBe('analytics-worker');
    });

    it('maps tinybird-sync to Tinybird sync worker', () => {
        expect(getDefaultServiceName('tinybird-sync')).toBe('analytics-tinybird-sync-worker');
    });

    it('maps false to ingest service', () => {
        expect(getDefaultServiceName('false')).toBe('analytics-service');
    });

    it('maps empty value to ingest service', () => {
        expect(getDefaultServiceName('')).toBe('analytics-service');
    });

    it('maps unknown value to ingest service', () => {
        expect(getDefaultServiceName('unknown')).toBe('analytics-service');
    });
});
