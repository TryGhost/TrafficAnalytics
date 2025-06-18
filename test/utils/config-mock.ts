import {vi} from 'vitest';

export function mockConfigGet(overrides: Record<string, any> = {}) {
    const defaults: Record<string, any> = {
        PORT: 3000,
        LOG_LEVEL: 'silent',
        PROXY_TARGET: 'http://localhost:3000/local-proxy',
        LOG_PROXY_REQUESTS: 'true',
        SALT_STORE_TYPE: 'memory',
        ENABLE_SALT_CLEANUP_SCHEDULER: 'true',
        GOOGLE_CLOUD_PROJECT: 'test-project',
        FIRESTORE_DATABASE_ID: 'test-db',
        PUBSUB_TOPIC_PAGE_HITS_RAW: 'test-topic',
        TRUST_PROXY: 'true'
    };

    return vi.fn((key: string) => {
        return overrides[key] ?? defaults[key];
    });
}