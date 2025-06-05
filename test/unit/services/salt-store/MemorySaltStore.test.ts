import {describe, it, expect, beforeEach, vi} from 'vitest';
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
            expect(result?.salt).toBe(salt);
            expect(result?.created_at).toBeInstanceOf(Date);
        });

        it('should create a new date for created_at', async () => {
            const key = '550e8400-e29b-41d4-a716-446655440000';
            const salt = 'random-salt-123';
            const beforeSet = new Date();

            const returnedRecord = await saltStore.set(key, salt);

            expect(returnedRecord.created_at.getTime()).toBeGreaterThanOrEqual(beforeSet.getTime());

            const result = await saltStore.get(key);
            expect(result?.created_at.getTime()).toBeGreaterThanOrEqual(beforeSet.getTime());
        });

        it('should throw error when trying to set existing key', async () => {
            const key = '550e8400-e29b-41d4-a716-446655440000';
            const originalSalt = 'original-salt';
            const newSalt = 'new-salt';

            await saltStore.set(key, originalSalt);

            await expect(saltStore.set(key, newSalt)).rejects.toThrow(`Salt for key "${key}" already exists`);

            // Verify original salt is still there
            const result = await saltStore.get(key);
            expect(result?.salt).toBe(originalSalt);
        });

        it('should successfully set salt for new keys', async () => {
            const key1 = '550e8400-e29b-41d4-a716-446655440000';
            const key2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
            const salt1 = 'salt-1';
            const salt2 = 'salt-2';

            // First key should succeed
            const record1 = await saltStore.set(key1, salt1);
            expect(record1?.salt).toBe(salt1);
            expect(record1?.created_at).toBeInstanceOf(Date);

            // Second key should also succeed
            const record2 = await saltStore.set(key2, salt2);
            expect(record2?.salt).toBe(salt2);
            expect(record2?.created_at).toBeInstanceOf(Date);

            // Verify both are stored
            const result1 = await saltStore.get(key1);
            const result2 = await saltStore.get(key2);
            expect(result1?.salt).toBe(salt1);
            expect(result2?.salt).toBe(salt2);
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
            expect(result1?.created_at).not.toBe(result2?.created_at);

            result1!.salt = 'modified';
            const result3 = await saltStore.get(key);
            expect(result3?.salt).toBe(salt);
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
            expect(resultBefore?.salt).toBe(salt);

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

            expect(result1?.salt).toBe(salt1);
            expect(result2).toBeUndefined();
            expect(result3?.salt).toBe(salt3);
        });
    });

    describe('clear', () => {
        it('should remove all salts from the store', async () => {
            const key1 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
            const key2 = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
            const key3 = '6ba7b812-9dad-11d1-80b4-00c04fd430c8';

            await saltStore.set(key1, 'salt-1');
            await saltStore.set(key2, 'salt-2');
            await saltStore.set(key3, 'salt-3');

            let allSalts = await saltStore.getAll();
            expect(Object.keys(allSalts)).toHaveLength(3);

            await saltStore.clear();

            allSalts = await saltStore.getAll();
            expect(Object.keys(allSalts)).toHaveLength(0);
            expect(allSalts).toEqual({});
        });

        it('should allow setting new salts after clear', async () => {
            const key1 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
            const key2 = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

            await saltStore.set(key1, 'salt-1');
            await saltStore.clear();

            // Should be able to set the same key again after clear
            await expect(saltStore.set(key1, 'new-salt-1')).resolves.toBeDefined();
            await expect(saltStore.set(key2, 'new-salt-2')).resolves.toBeDefined();

            const allSalts = await saltStore.getAll();
            expect(Object.keys(allSalts)).toHaveLength(2);
            expect(allSalts[key1].salt).toBe('new-salt-1');
            expect(allSalts[key2].salt).toBe('new-salt-2');
        });

        it('should work correctly when called on empty store', async () => {
            await expect(saltStore.clear()).resolves.toBeUndefined();

            const allSalts = await saltStore.getAll();
            expect(allSalts).toEqual({});
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
                expect(salt!.salt).toBe(salts[i]);
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

            expect(result1!.salt).toBe('salt1');
            expect(result2!.salt).toBe('salt2');
            expect(missing1).toBeUndefined();
            expect(missing2).toBeUndefined();
        });
    });

    describe('cleanup', () => {
        it('should delete salts from before today UTC', async () => {
            // Mock today as 2024-01-15 in UTC
            vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-15T12:00:00.000Z');
            
            const key1 = '550e8400-e29b-41d4-a716-446655440001';
            const key2 = '550e8400-e29b-41d4-a716-446655440002';
            const key3 = '550e8400-e29b-41d4-a716-446655440003';
            
            await saltStore.set(key1, 'yesterday-salt');
            await saltStore.set(key2, 'today-salt');
            await saltStore.set(key3, 'old-salt');

            // Manually set the created_at dates
            (saltStore as any).salts[key1].created_at = new Date('2024-01-14T23:59:59.999Z'); // Yesterday
            (saltStore as any).salts[key2].created_at = new Date('2024-01-15T00:00:00.000Z'); // Today at midnight
            (saltStore as any).salts[key3].created_at = new Date('2024-01-10T12:00:00.000Z'); // 5 days ago

            const deletedCount = await saltStore.cleanup();

            expect(deletedCount).toBe(2); // Yesterday and old salt deleted
            
            const result1 = await saltStore.get(key1);
            const result2 = await saltStore.get(key2);
            const result3 = await saltStore.get(key3);
            
            expect(result1).toBeUndefined();
            expect(result2?.salt).toBe('today-salt');
            expect(result3).toBeUndefined();
        });

        it('should keep salts created at exactly midnight UTC today', async () => {
            // Mock today as 2024-01-15
            vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-15T12:00:00.000Z');

            const key = '550e8400-e29b-41d4-a716-446655440000';
            await saltStore.set(key, 'midnight-salt');
            (saltStore as any).salts[key].created_at = new Date('2024-01-15T00:00:00.000Z');

            const deletedCount = await saltStore.cleanup();

            // Should NOT be deleted because it's from today
            expect(deletedCount).toBe(0);
            
            const result = await saltStore.get(key);
            expect(result?.salt).toBe('midnight-salt');
        });

        it('should return 0 when all salts are from today', async () => {
            await saltStore.set('key1', 'salt1');
            await saltStore.set('key2', 'salt2');

            const deletedCount = await saltStore.cleanup();

            expect(deletedCount).toBe(0);
            
            const all = await saltStore.getAll();
            expect(Object.keys(all)).toHaveLength(2);
        });

        it('should handle empty store', async () => {
            const deletedCount = await saltStore.cleanup();
            
            expect(deletedCount).toBe(0);
        });

        it('should handle salts from different dates correctly', async () => {
            // Mock today as 2024-01-15
            vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-15T08:00:00.000Z');
            
            const keys = [
                'salt:2024-01-10:old1',
                'salt:2024-01-14:yesterday',
                'salt:2024-01-15:today1',
                'salt:2024-01-15:today2',
                'salt:2024-01-13:old2'
            ];
            
            for (const key of keys) {
                await saltStore.set(key, `value-${key}`);
            }
            
            // Set created_at based on the date in the key
            (saltStore as any).salts[keys[0]].created_at = new Date('2024-01-10T12:00:00.000Z');
            (saltStore as any).salts[keys[1]].created_at = new Date('2024-01-14T12:00:00.000Z');
            (saltStore as any).salts[keys[2]].created_at = new Date('2024-01-15T01:00:00.000Z');
            (saltStore as any).salts[keys[3]].created_at = new Date('2024-01-15T23:59:59.999Z');
            (saltStore as any).salts[keys[4]].created_at = new Date('2024-01-13T12:00:00.000Z');

            const deletedCount = await saltStore.cleanup();

            expect(deletedCount).toBe(3); // 3 salts from before today
            
            const all = await saltStore.getAll();
            expect(Object.keys(all)).toHaveLength(2); // Only today's salts remain
            expect(all[keys[2]]).toBeDefined();
            expect(all[keys[3]]).toBeDefined();
        });
    });
});
