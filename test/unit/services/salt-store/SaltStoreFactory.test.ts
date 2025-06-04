import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {createSaltStore, SaltStoreConfig} from '../../../../src/services/salt-store/SaltStoreFactory';
import {MemorySaltStore} from '../../../../src/services/salt-store/MemorySaltStore';
import {FirestoreSaltStore} from '../../../../src/services/salt-store/FirestoreSaltStore';
import type {ISaltStore} from '../../../../src/services/salt-store/ISaltStore';

describe('SaltStoreFactory', () => {
    let originalEnv: string | undefined;

    beforeEach(() => {
        // Save original env value
        originalEnv = process.env.SALT_STORE_TYPE;
        // Clear it for tests
        delete process.env.SALT_STORE_TYPE;
    });

    afterEach(() => {
        // Restore original env value
        if (originalEnv !== undefined) {
            process.env.SALT_STORE_TYPE = originalEnv;
        } else {
            delete process.env.SALT_STORE_TYPE;
        }
    });

    describe('createSaltStore', () => {
        it('should create a memory salt store by default', () => {
            const store = createSaltStore();

            expect(store).toBeInstanceOf(MemorySaltStore);
            expect(store).toHaveProperty('get');
            expect(store).toHaveProperty('set');
            expect(store).toHaveProperty('getAll');
        });

        it('should create a memory salt store with explicit memory config', () => {
            const config: SaltStoreConfig = {type: 'memory'};
            const store = createSaltStore(config);

            expect(store).toBeInstanceOf(MemorySaltStore);
        });

        it('should create a firestore salt store with firestore config', () => {
            const config: SaltStoreConfig = {type: 'firestore'};
            const store = createSaltStore(config);

            expect(store).toBeInstanceOf(FirestoreSaltStore);
            expect(store).toHaveProperty('get');
            expect(store).toHaveProperty('set');
            expect(store).toHaveProperty('getAll');
            expect(store).toHaveProperty('delete');
        });

        it('should create firestore store with custom project and collection', () => {
            const config: SaltStoreConfig = {
                type: 'firestore',
                projectId: 'custom-project',
                collectionName: 'custom-salts'
            };
            const store = createSaltStore(config);

            expect(store).toBeInstanceOf(FirestoreSaltStore);
        });

        it('should create firestore store from environment variable', () => {
            process.env.SALT_STORE_TYPE = 'firestore';
            const store = createSaltStore();

            expect(store).toBeInstanceOf(FirestoreSaltStore);
        });

        it('should throw error for file store type', () => {
            const config: SaltStoreConfig = {type: 'file'};

            expect(() => createSaltStore(config)).toThrow('File salt store is not implemented yet');
        });

        it('should throw error for unknown store type', () => {
            const config = {type: 'unknown' as 'memory'};

            expect(() => createSaltStore(config)).toThrow('Unknown salt store type: unknown');
        });

        it('should handle undefined config gracefully', () => {
            const store = createSaltStore(undefined);

            expect(store).toBeInstanceOf(MemorySaltStore);
        });

        it('should handle empty config object', () => {
            const config = {} as SaltStoreConfig;
            const store = createSaltStore(config);

            expect(store).toBeInstanceOf(MemorySaltStore);
        });
    });

    describe('returned salt store functionality', () => {
        it('should return a functional ISaltStore instance', async () => {
            const store: ISaltStore = createSaltStore();

            await store.set('test-key', 'test-salt');
            const result = await store.get('test-key');

            expect(result?.salt).toBe('test-salt');
            expect(result?.created_at).toBeInstanceOf(Date);
        });

        it('should create independent store instances', async () => {
            const store1 = createSaltStore();
            const store2 = createSaltStore();

            await store1.set('key1', 'salt1');
            await store2.set('key2', 'salt2');

            const result1 = await store1.get('key1');
            const result2 = await store2.get('key2');
            const missing1 = await store1.get('key2');
            const missing2 = await store2.get('key1');

            expect(result1?.salt).toBe('salt1');
            expect(result2?.salt).toBe('salt2');
            expect(missing1).toBeUndefined();
            expect(missing2).toBeUndefined();
        });
    });
});
