import {describe, it, expect, beforeEach} from 'vitest';
import {MemorySaltStore} from '../../../../src/services/salt-store/MemorySaltStore';

describe('MemorySaltStore', () => {
    let saltStore: MemorySaltStore;

    beforeEach(() => {
        saltStore = new MemorySaltStore();
    });

    describe('set', () => {
        it('should store a salt with key and return the created record', async () => {
            const key = '550e8400-e29b-41d4-a716-446655440000';
            const salt = 'random-salt-123';

            const returnedRecord = await saltStore.set(key, salt);

            expect(returnedRecord.salt).toBe(salt);
            expect(returnedRecord.created_at).toBeInstanceOf(Date);

            const result = await saltStore.get(key);
            expect(result.salt).toBe(salt);
            expect(result.created_at).toBeInstanceOf(Date);
        });

        it('should create a new date for created_at', async () => {
            const key = '550e8400-e29b-41d4-a716-446655440000';
            const salt = 'random-salt-123';
            const beforeSet = new Date();

            const returnedRecord = await saltStore.set(key, salt);

            expect(returnedRecord.created_at.getTime()).toBeGreaterThanOrEqual(beforeSet.getTime());

            const result = await saltStore.get(key);
            expect(result.created_at.getTime()).toBeGreaterThanOrEqual(beforeSet.getTime());
        });

        it('should throw error when trying to set existing key', async () => {
            const key = '550e8400-e29b-41d4-a716-446655440000';
            const originalSalt = 'original-salt';
            const newSalt = 'new-salt';

            await saltStore.set(key, originalSalt);

            await expect(saltStore.set(key, newSalt)).rejects.toThrow(`Salt for key "${key}" already exists`);

            // Verify original salt is still there
            const result = await saltStore.get(key);
            expect(result.salt).toBe(originalSalt);
        });

        it('should successfully set salt for new keys', async () => {
            const key1 = '550e8400-e29b-41d4-a716-446655440000';
            const key2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
            const salt1 = 'salt-1';
            const salt2 = 'salt-2';

            // First key should succeed
            const record1 = await saltStore.set(key1, salt1);
            expect(record1.salt).toBe(salt1);
            expect(record1.created_at).toBeInstanceOf(Date);

            // Second key should also succeed
            const record2 = await saltStore.set(key2, salt2);
            expect(record2.salt).toBe(salt2);
            expect(record2.created_at).toBeInstanceOf(Date);

            // Verify both are stored
            const result1 = await saltStore.get(key1);
            const result2 = await saltStore.get(key2);
            expect(result1.salt).toBe(salt1);
            expect(result2.salt).toBe(salt2);
        });
    });

    describe('get', () => {
        it('should return salt record for existing key', async () => {
            const key = '550e8400-e29b-41d4-a716-446655440000';
            const salt = 'random-salt-123';

            await saltStore.set(key, salt);
            const result = await saltStore.get(key);

            expect(result).toEqual({
                salt: salt,
                created_at: expect.any(Date)
            });
        });

        it('should return undefined for non-existent key', async () => {
            const result = await saltStore.get('987fcdeb-51d2-43e1-9b45-123456789abc');
            expect(result).toBeUndefined();
        });

        it('should return a copy of the salt record', async () => {
            const key = '550e8400-e29b-41d4-a716-446655440000';
            const salt = 'random-salt-123';

            await saltStore.set(key, salt);
            const result1 = await saltStore.get(key);
            const result2 = await saltStore.get(key);

            expect(result1).toEqual(result2);
            expect(result1).not.toBe(result2);
            expect(result1.created_at).not.toBe(result2.created_at);

            result1.salt = 'modified';
            const result3 = await saltStore.get(key);
            expect(result3.salt).toBe(salt);
        });
    });

    describe('getAll', () => {
        it('should return empty object when no salts are stored', async () => {
            const result = await saltStore.getAll();
            expect(result).toEqual({});
        });

        it('should return all stored salts', async () => {
            const salt1 = 'salt-1';
            const salt2 = 'salt-2';
            const key1 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
            const key2 = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

            await saltStore.set(key1, salt1);
            await saltStore.set(key2, salt2);

            const result = await saltStore.getAll();

            expect(Object.keys(result)).toHaveLength(2);
            expect(result[key1].salt).toBe(salt1);
            expect(result[key2].salt).toBe(salt2);
            expect(result[key1].created_at).toBeInstanceOf(Date);
            expect(result[key2].created_at).toBeInstanceOf(Date);
        });

        it('should return a copy of the internal state', async () => {
            const key = '550e8400-e29b-41d4-a716-446655440000';
            const salt = 'random-salt-123';

            await saltStore.set(key, salt);
            const result1 = await saltStore.getAll();
            const result2 = await saltStore.getAll();

            expect(result1).toEqual(result2);
            expect(result1).not.toBe(result2);

            result1[key].salt = 'modified';
            const result3 = await saltStore.getAll();
            expect(result3[key].salt).toBe(salt);
        });
    });

    describe('delete', () => {
        it('should delete an existing salt', async () => {
            const key = '550e8400-e29b-41d4-a716-446655440000';
            const salt = 'random-salt-123';

            await saltStore.set(key, salt);

            const resultBefore = await saltStore.get(key);
            expect(resultBefore).toBeDefined();
            expect(resultBefore.salt).toBe(salt);

            await saltStore.delete(key);

            const resultAfter = await saltStore.get(key);
            expect(resultAfter).toBeUndefined();
        });

        it('should not throw when deleting non-existent key', async () => {
            await expect(saltStore.delete('987fcdeb-51d2-43e1-9b45-123456789abc')).resolves.toBeUndefined();
        });

        it('should remove salt from getAll results', async () => {
            const key1 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
            const key2 = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
            const salt1 = 'salt-1';
            const salt2 = 'salt-2';

            await saltStore.set(key1, salt1);
            await saltStore.set(key2, salt2);

            let allSalts = await saltStore.getAll();
            expect(Object.keys(allSalts)).toHaveLength(2);
            expect(allSalts[key1]).toBeDefined();
            expect(allSalts[key2]).toBeDefined();

            await saltStore.delete(key1);

            allSalts = await saltStore.getAll();
            expect(Object.keys(allSalts)).toHaveLength(1);
            expect(allSalts[key1]).toBeUndefined();
            expect(allSalts[key2]).toBeDefined();
            expect(allSalts[key2].salt).toBe(salt2);
        });

        it('should handle multiple deletes on same key', async () => {
            const key = '550e8400-e29b-41d4-a716-446655440000';
            const salt = 'random-salt-123';

            await saltStore.set(key, salt);
            await saltStore.delete(key);

            await expect(saltStore.delete(key)).resolves.toBeUndefined();

            const result = await saltStore.get(key);
            expect(result).toBeUndefined();
        });

        it('should not affect other salts when deleting', async () => {
            const key1 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
            const key2 = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
            const key3 = '6ba7b812-9dad-11d1-80b4-00c04fd430c8';
            const salt1 = 'salt-1';
            const salt2 = 'salt-2';
            const salt3 = 'salt-3';

            await saltStore.set(key1, salt1);
            await saltStore.set(key2, salt2);
            await saltStore.set(key3, salt3);

            await saltStore.delete(key2);

            const result1 = await saltStore.get(key1);
            const result2 = await saltStore.get(key2);
            const result3 = await saltStore.get(key3);

            expect(result1.salt).toBe(salt1);
            expect(result2).toBeUndefined();
            expect(result3.salt).toBe(salt3);
        });
    });

    describe('integration tests', () => {
        it('should handle multiple operations correctly', async () => {
            const keys = ['6ba7b810-9dad-11d1-80b4-00c04fd430c8', '6ba7b811-9dad-11d1-80b4-00c04fd430c8', '6ba7b812-9dad-11d1-80b4-00c04fd430c8'];
            const salts = ['salt-1', 'salt-2', 'salt-3'];

            for (let i = 0; i < keys.length; i++) {
                const returnedRecord = await saltStore.set(keys[i], salts[i]);
                expect(returnedRecord.salt).toBe(salts[i]);
            }

            const allSalts = await saltStore.getAll();
            expect(Object.keys(allSalts)).toHaveLength(3);

            for (let i = 0; i < keys.length; i++) {
                const salt = await saltStore.get(keys[i]);
                expect(salt.salt).toBe(salts[i]);
            }

            await saltStore.delete(keys[1]);

            const allSaltsAfterDelete = await saltStore.getAll();
            expect(Object.keys(allSaltsAfterDelete)).toHaveLength(2);
            expect(allSaltsAfterDelete[keys[0]]).toBeDefined();
            expect(allSaltsAfterDelete[keys[1]]).toBeUndefined();
            expect(allSaltsAfterDelete[keys[2]]).toBeDefined();
        });

        it('should maintain isolation between different instances', async () => {
            const store1 = new MemorySaltStore();
            const store2 = new MemorySaltStore();

            await store1.set('550e8400-e29b-41d4-a716-446655440000', 'salt1');
            await store2.set('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'salt2');

            const result1 = await store1.get('550e8400-e29b-41d4-a716-446655440000');
            const result2 = await store2.get('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
            const missing1 = await store1.get('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
            const missing2 = await store2.get('550e8400-e29b-41d4-a716-446655440000');

            expect(result1.salt).toBe('salt1');
            expect(result2.salt).toBe('salt2');
            expect(missing1).toBeUndefined();
            expect(missing2).toBeUndefined();
        });
    });
});
