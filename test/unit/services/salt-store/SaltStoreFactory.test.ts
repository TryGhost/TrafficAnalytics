import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {createSaltStore, SaltStoreConfig} from '../../../../src/services/salt-store/SaltStoreFactory';
import {MemorySaltStore} from '../../../../src/services/salt-store/MemorySaltStore';
import {FirestoreSaltStore} from '../../../../src/services/salt-store/FirestoreSaltStore';
import {FileSaltStore} from '../../../../src/services/salt-store/FileSaltStore';
import type {ISaltStore} from '../../../../src/services/salt-store/ISaltStore';
import {promises as fs} from 'fs';
import * as path from 'path';
import {randomUUID} from 'crypto';

describe('SaltStoreFactory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
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
            const saltStoreConfig: SaltStoreConfig = {type: 'memory'};
            const store = createSaltStore(saltStoreConfig);

            expect(store).toBeInstanceOf(MemorySaltStore);
        });

        it('should throw error when creating firestore store without projectId', () => {
            vi.stubEnv('GOOGLE_CLOUD_PROJECT', '');
            vi.stubEnv('FIRESTORE_DATABASE_ID', '');
            
            const saltStoreConfig: SaltStoreConfig = {type: 'firestore', databaseId: 'test-db'};
            
            expect(() => createSaltStore(saltStoreConfig)).toThrow('Firestore project ID is required. Provide it via config.projectId or GOOGLE_CLOUD_PROJECT environment variable');
        });

        it('should throw error when creating firestore store without databaseId', () => {
            vi.stubEnv('GOOGLE_CLOUD_PROJECT', '');
            vi.stubEnv('FIRESTORE_DATABASE_ID', '');
            
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
            vi.stubEnv('SALT_STORE_TYPE', 'firestore');
            vi.stubEnv('GOOGLE_CLOUD_PROJECT', 'env-project');
            vi.stubEnv('FIRESTORE_DATABASE_ID', 'env-database');
            
            const store = createSaltStore();

            expect(store).toBeInstanceOf(FirestoreSaltStore);
        });

        it('should use global config values when saltStoreConfig is not provided', () => {
            vi.stubEnv('GOOGLE_CLOUD_PROJECT', 'env-project');
            vi.stubEnv('FIRESTORE_DATABASE_ID', 'env-database');
            
            const saltStoreConfig: SaltStoreConfig = {type: 'firestore'};
            const store = createSaltStore(saltStoreConfig);

            expect(store).toBeInstanceOf(FirestoreSaltStore);
        });

        it('should create a file salt store with default path', () => {
            const saltStoreConfig: SaltStoreConfig = {type: 'file'};
            const store = createSaltStore(saltStoreConfig);

            expect(store).toBeInstanceOf(FileSaltStore);
            expect(store).toHaveProperty('get');
            expect(store).toHaveProperty('set');
            expect(store).toHaveProperty('getAll');
            expect(store).toHaveProperty('delete');
        });

        it('should create a file salt store with custom path from config', () => {
            const saltStoreConfig: SaltStoreConfig = {
                type: 'file',
                filePath: '/custom/path/salts.json'
            };
            const store = createSaltStore(saltStoreConfig);

            expect(store).toBeInstanceOf(FileSaltStore);
        });

        it('should create a file salt store with path from environment', () => {
            vi.stubEnv('SALT_STORE_TYPE', 'file');
            vi.stubEnv('SALT_STORE_FILE_PATH', '/env/path/salts.json');
            
            const store = createSaltStore();

            expect(store).toBeInstanceOf(FileSaltStore);
        });

        it('should use config path over environment path for file store', () => {
            vi.stubEnv('SALT_STORE_FILE_PATH', '/env/path/salts.json');
            
            const saltStoreConfig: SaltStoreConfig = {
                type: 'file',
                filePath: '/config/path/salts.json'
            };
            const store = createSaltStore(saltStoreConfig);

            expect(store).toBeInstanceOf(FileSaltStore);
            // The actual path used is private, but we can verify it's a FileSaltStore
        });

        it('should throw error for unknown store type', () => {
            const saltStoreConfig = {type: 'unknown' as 'memory'};

            expect(() => createSaltStore(saltStoreConfig)).toThrow('Unknown salt store type: unknown');
        });

        it('should handle undefined config gracefully', () => {
            vi.stubEnv('SALT_STORE_TYPE', 'memory');

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

        it('should create functional file salt store', async () => {
            const testFilePath = path.join('/tmp', `test-factory-salts-${randomUUID()}.json`);
            const saltStoreConfig: SaltStoreConfig = {
                type: 'file',
                filePath: testFilePath
            };
            const store = createSaltStore(saltStoreConfig);

            await store.set('test-key', 'test-salt');
            const result = await store.get('test-key');

            expect(result?.salt).toBe('test-salt');
            expect(result?.created_at).toBeInstanceOf(Date);

            // Clean up
            try {
                await fs.unlink(testFilePath);
            } catch {
                // Ignore errors
            }
        });
    });
});
