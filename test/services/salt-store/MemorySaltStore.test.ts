import {describe, it, expect, beforeEach} from 'vitest';
import {MemorySaltStore} from '../../../src/services/salt-store/MemorySaltStore';

describe('MemorySaltStore', () => {
    let saltStore: MemorySaltStore;

    beforeEach(() => {
        saltStore = new MemorySaltStore();
    });

    describe('set', () => {
        it('should store a salt with key', async () => {
            const key = 'test-site-uuid';
            const salt = 'random-salt-123';

            await saltStore.set(key, salt);

            const result = await saltStore.get(key);
            expect(result.salt).toBe(salt);
            expect(result.created_at).toBeInstanceOf(Date);
        });

        it('should create a new date for created_at', async () => {
            const key = 'test-site-uuid';
            const salt = 'random-salt-123';
            const beforeSet = new Date();

            await saltStore.set(key, salt);

            const result = await saltStore.get(key);
            expect(result.created_at.getTime()).toBeGreaterThanOrEqual(beforeSet.getTime());
        });

        it('should overwrite existing salt', async () => {
            const key = 'test-site-uuid';
            const originalSalt = 'original-salt';
            const newSalt = 'new-salt';

            await saltStore.set(key, originalSalt);
            await saltStore.set(key, newSalt);

            const result = await saltStore.get(key);
            expect(result.salt).toBe(newSalt);
        });
    });

    describe('get', () => {
        it('should return salt record for existing key', async () => {
            const key = 'test-site-uuid';
            const salt = 'random-salt-123';

            await saltStore.set(key, salt);
            const result = await saltStore.get(key);

            expect(result).toEqual({
                salt: salt,
                created_at: expect.any(Date)
            });
        });

        it('should return undefined for non-existent key', async () => {
            const result = await saltStore.get('non-existent-key');
            expect(result).toBeUndefined();
        });

        it('should return a copy of the salt record', async () => {
            const key = 'test-site-uuid';
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
            const key1 = 'site-uuid-1';
            const key2 = 'site-uuid-2';

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
            const key = 'test-site-uuid';
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

    describe('integration tests', () => {
        it('should handle multiple operations correctly', async () => {
            const keys = ['site-1', 'site-2', 'site-3'];
            const salts = ['salt-1', 'salt-2', 'salt-3'];

            for (let i = 0; i < keys.length; i++) {
                await saltStore.set(keys[i], salts[i]);
            }

            const allSalts = await saltStore.getAll();
            expect(Object.keys(allSalts)).toHaveLength(3);

            for (let i = 0; i < keys.length; i++) {
                const salt = await saltStore.get(keys[i]);
                expect(salt.salt).toBe(salts[i]);
            }
        });

        it('should maintain isolation between different instances', async () => {
            const store1 = new MemorySaltStore();
            const store2 = new MemorySaltStore();

            await store1.set('key1', 'salt1');
            await store2.set('key2', 'salt2');

            const result1 = await store1.get('key1');
            const result2 = await store2.get('key2');
            const missing1 = await store1.get('key2');
            const missing2 = await store2.get('key1');

            expect(result1.salt).toBe('salt1');
            expect(result2.salt).toBe('salt2');
            expect(missing1).toBeUndefined();
            expect(missing2).toBeUndefined();
        });
    });
});
