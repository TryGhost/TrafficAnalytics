import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {createSaltStore, SaltStoreConfig} from '../../../../src/services/salt-store/SaltStoreFactory';
import {MemorySaltStore} from '../../../../src/services/salt-store/MemorySaltStore';
import {FirestoreSaltStore} from '../../../../src/services/salt-store/FirestoreSaltStore';
import type {ISaltStore} from '../../../../src/services/salt-store/ISaltStore';
import config from '@tryghost/config';
import {mockConfigGet} from '../../../utils/config-mock';

vi.mock('@tryghost/config');

describe('SaltStoreFactory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('createSaltStore', () => {
        it('should create a memory salt store by default', () => {
            config.get = mockConfigGet();

            const store = createSaltStore();

            expect(store).toBeInstanceOf(MemorySaltStore);
            expect(store).toHaveProperty('get');
            expect(store).toHaveProperty('set');
            expect(store).toHaveProperty('getAll');
        });

        it('should create a memory salt store with explicit memory config', () => {
            config.get = mockConfigGet();
            
            const saltStoreConfig: SaltStoreConfig = {type: 'memory'};
            const store = createSaltStore(saltStoreConfig);

            expect(store).toBeInstanceOf(MemorySaltStore);
        });

        it('should throw error when creating firestore store without projectId', () => {
            config.get = mockConfigGet({
                GOOGLE_CLOUD_PROJECT: '',
                FIRESTORE_DATABASE_ID: ''
            });
            
            const saltStoreConfig: SaltStoreConfig = {type: 'firestore', databaseId: 'test-db'};
            
            expect(() => createSaltStore(saltStoreConfig)).toThrow('Firestore project ID is required. Provide it via config.projectId or GOOGLE_CLOUD_PROJECT environment variable');
        });

        it('should throw error when creating firestore store without databaseId', () => {
            config.get = mockConfigGet({
                GOOGLE_CLOUD_PROJECT: '',
                FIRESTORE_DATABASE_ID: ''
            });
            
            const saltStoreConfig: SaltStoreConfig = {type: 'firestore', projectId: 'test-project'};
            
            expect(() => createSaltStore(saltStoreConfig)).toThrow('Firestore database ID is required. Provide it via config.databaseId or FIRESTORE_DATABASE_ID environment variable');
        });

        it('should create a firestore salt store with complete config', () => {
            const saltStoreConfig: SaltStoreConfig = {
                type: 'firestore',
                projectId: 'test-project',
                databaseId: 'test-database'
            };
            const store = createSaltStore(saltStoreConfig);

            expect(store).toBeInstanceOf(FirestoreSaltStore);
            expect(store).toHaveProperty('get');
            expect(store).toHaveProperty('set');
            expect(store).toHaveProperty('getAll');
            expect(store).toHaveProperty('delete');
        });

        it('should create firestore store with custom project and collection', () => {
            const saltStoreConfig: SaltStoreConfig = {
                type: 'firestore',
                projectId: 'custom-project',
                databaseId: 'custom-database',
                collectionName: 'custom-salts'
            };
            const store = createSaltStore(saltStoreConfig);

            expect(store).toBeInstanceOf(FirestoreSaltStore);
        });

        it('should create firestore store with custom project, database and collection', () => {
            const saltStoreConfig: SaltStoreConfig = {
                type: 'firestore',
                projectId: 'custom-project',
                databaseId: 'custom-database',
                collectionName: 'custom-salts'
            };
            const store = createSaltStore(saltStoreConfig);

            expect(store).toBeInstanceOf(FirestoreSaltStore);
        });

        it('should create firestore store from config', () => {
            config.get = mockConfigGet({
                SALT_STORE_TYPE: 'firestore',
                GOOGLE_CLOUD_PROJECT: 'env-project',
                FIRESTORE_DATABASE_ID: 'env-database'
            });

            const store = createSaltStore();

            expect(store).toBeInstanceOf(FirestoreSaltStore);
        });

        it('should use global config values when saltStoreConfig is not provided', () => {
            config.get = mockConfigGet({
                GOOGLE_CLOUD_PROJECT: 'env-project',
                FIRESTORE_DATABASE_ID: 'env-database'
            });
            
            const saltStoreConfig: SaltStoreConfig = {type: 'firestore'};
            const store = createSaltStore(saltStoreConfig);

            expect(store).toBeInstanceOf(FirestoreSaltStore);
        });

        it('should throw error for file store type', () => {
            const saltStoreConfig: SaltStoreConfig = {type: 'file'};

            expect(() => createSaltStore(saltStoreConfig)).toThrow('File salt store is not implemented yet');
        });

        it('should throw error for unknown store type', () => {
            const saltStoreConfig = {type: 'unknown' as 'memory'};

            expect(() => createSaltStore(saltStoreConfig)).toThrow('Unknown salt store type: unknown');
        });

        it('should handle undefined config gracefully', () => {
            vi.mocked(config.get).mockImplementation((key) => {
                if (key === 'SALT_STORE_TYPE') {
                    return 'memory';
                }
                return undefined;
            });

            const store = createSaltStore(undefined);

            expect(store).toBeInstanceOf(MemorySaltStore);
        });

        it('should handle empty config object', () => {
            const saltStoreConfig = {} as SaltStoreConfig;
            const store = createSaltStore(saltStoreConfig);

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
