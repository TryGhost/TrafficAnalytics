import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {FirestoreSaltStore} from '../../../../src/services/salt-store/FirestoreSaltStore';

describe('FirestoreSaltStore', () => {
    let saltStore: FirestoreSaltStore;
    let testCollectionName: string;

    beforeEach(async () => {
        // Create a new instance for each test
        // Using environment-configured project and database IDs
        testCollectionName = process.env.FIRESTORE_SALT_COLLECTION || 'salts';
        const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'traffic-analytics-test';
        const databaseId = process.env.FIRESTORE_DATABASE_ID || '(default)';
        
        saltStore = new FirestoreSaltStore(projectId, databaseId, testCollectionName);

        // Clean up any existing test data using the store's clear method
        await saltStore.clear();
    });

    afterEach(async () => {
        // Clean up test data after each test
        await saltStore.clear();
    });

    describe('set', () => {
        it('should store a salt successfully', async () => {
            const key = 'salt:2024-01-01:550e8400-e29b-41d4-a716-446655440000';
            const salt = 'random-salt-value';

            const record = await saltStore.set(key, salt);

            expect(record).toBeDefined();
            expect(record.salt).toBe(salt);
            expect(record.created_at).toBeInstanceOf(Date);
        });

        it('should throw error if key already exists', async () => {
            const key = 'salt:2024-01-01:6ba7b810-9dad-11d1-80b4-00c04fd430c8';
            const salt = 'random-salt-value';

            await saltStore.set(key, salt);

            await expect(saltStore.set(key, 'another-salt'))
                .rejects.toThrow('Salt with key salt:2024-01-01:6ba7b810-9dad-11d1-80b4-00c04fd430c8 already exists');
        });
    });

    describe('get', () => {
        it('should retrieve an existing salt', async () => {
            const key = 'salt:2024-01-01:f47ac10b-58cc-4372-a567-0e02b2c3d479';
            const salt = 'random-salt-value';

            await saltStore.set(key, salt);
            const record = await saltStore.get(key);

            expect(record).toBeDefined();
            expect(record!.salt).toBe(salt);
            expect(record!.created_at).toBeInstanceOf(Date);
        });

        it('should return undefined for non-existent key', async () => {
            const record = await saltStore.get('salt:2024-01-01:123e4567-e89b-12d3-a456-426614174000');

            expect(record).toBeUndefined();
        });
    });

    describe('getAll', () => {
        it('should return empty object when no salts exist', async () => {
            const records = await saltStore.getAll();

            expect(records).toEqual({});
        });

        it('should return all salts', async () => {
            // Add some salts
            await saltStore.set('salt:2024-01-01:a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'salt-1');
            await saltStore.set('salt:2024-01-01:b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'salt-2');
            await saltStore.set('salt:2024-01-02:a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'salt-3'); // Different date

            const records = await saltStore.getAll();

            expect(Object.keys(records).length).toBe(3);
            expect(records['salt:2024-01-01:a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'].salt).toBe('salt-1');
            expect(records['salt:2024-01-01:b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'].salt).toBe('salt-2');
            expect(records['salt:2024-01-02:a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'].salt).toBe('salt-3');
        });
    });

    describe('delete', () => {
        it('should delete an existing salt', async () => {
            const key = 'salt:2024-01-01:c9bf9e57-1685-4c89-bafb-ff5af830be8a';
            const salt = 'random-salt-value';

            await saltStore.set(key, salt);
            await saltStore.delete(key);

            const record = await saltStore.get(key);
            expect(record).toBeUndefined();
        });

        it('should not throw error when deleting non-existent key', async () => {
            await expect(saltStore.delete('salt:2024-01-01:d9bf9e57-1685-4c89-bafb-ff5af830be8b'))
                .resolves.not.toThrow();
        });
    });

    describe('integration with UserSignatureService', () => {
        it('should work with the expected interface', async () => {
            const key = 'salt:2024-01-01:e9bf9e57-1685-4c89-bafb-ff5af830be8c';

            // Test the flow that UserSignatureService uses
            const existingSalt = await saltStore.get(key);
            expect(existingSalt).toBeFalsy(); // Should be undefined

            if (!existingSalt) {
                const newSalt = 'newly-generated-salt';
                await saltStore.set(key, newSalt);

                const retrievedSalt = await saltStore.get(key);
                expect(retrievedSalt).toBeDefined();
                expect(retrievedSalt!.salt).toBe(newSalt);
            }
        });
    });

    describe('cleanup', () => {
        it('should delete salts from before today UTC', async () => {
            const key1 = 'salt:2024-01-14:cleanup-test-1';
            const key2 = 'salt:2024-01-15:cleanup-test-2';
            const key3 = 'salt:2024-01-10:cleanup-test-3';

            await saltStore.set(key1, 'yesterday-salt');
            await saltStore.set(key2, 'today-salt');
            await saltStore.set(key3, 'old-salt');

            // Mock today as 2024-01-15
            vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-15T12:00:00.000Z');

            // Update timestamps
            const firestore = (saltStore as any).firestore;
            const batch = firestore.batch();
            
            batch.update(firestore.collection(testCollectionName).doc(key1), { 
                created_at: new Date('2024-01-14T23:59:59.999Z') 
            });
            batch.update(firestore.collection(testCollectionName).doc(key2), { 
                created_at: new Date('2024-01-15T00:00:00.000Z') 
            });
            batch.update(firestore.collection(testCollectionName).doc(key3), { 
                created_at: new Date('2024-01-10T12:00:00.000Z') 
            });
            
            await batch.commit();

            const deletedCount = await saltStore.cleanup();

            expect(deletedCount).toBe(2);

            const result1 = await saltStore.get(key1);
            const result2 = await saltStore.get(key2);
            const result3 = await saltStore.get(key3);

            expect(result1).toBeUndefined();
            expect(result2?.salt).toBe('today-salt');
            expect(result3).toBeUndefined();
        });

        it('should keep salts created at exactly midnight UTC today', async () => {
            const key = 'salt:2024-01-15:midnight-test';
            await saltStore.set(key, 'midnight-salt');

            // Mock today as 2024-01-15
            vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-15T12:00:00.000Z');

            const firestore = (saltStore as any).firestore;
            await firestore.collection(testCollectionName).doc(key).update({ 
                created_at: new Date('2024-01-15T00:00:00.000Z') 
            });

            const deletedCount = await saltStore.cleanup();

            expect(deletedCount).toBe(0);

            const result = await saltStore.get(key);
            expect(result?.salt).toBe('midnight-salt');
        });

        it('should return 0 when all salts are from today', async () => {
            await saltStore.set('salt:cleanup:today-1', 'salt1');
            await saltStore.set('salt:cleanup:today-2', 'salt2');

            const deletedCount = await saltStore.cleanup();

            expect(deletedCount).toBe(0);

            const all = await saltStore.getAll();
            expect(Object.keys(all)).toHaveLength(2);
        });
    });
});