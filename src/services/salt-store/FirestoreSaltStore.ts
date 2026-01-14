import {Firestore} from '@google-cloud/firestore';
import {ISaltStore, SaltRecord} from './ISaltStore';
import logger from '../../utils/logger';

/**
 * Error thrown when attempting to create a salt that already exists.
 * Used for precise error handling in race condition scenarios.
 */
export class SaltAlreadyExistsError extends Error {
    public readonly code = 'SALT_ALREADY_EXISTS';
    
    constructor(key: string) {
        super(`Salt with key ${key} already exists`);
        this.name = 'SaltAlreadyExistsError';
    }
}

/**
 * Firestore implementation of the salt store.
 *
 * Stores salts in a Firestore collection. Salts are keyed by date,
 * so they naturally rotate daily without needing explicit expiration.
 */
export class FirestoreSaltStore implements ISaltStore {
    private firestore: Firestore;
    private collectionName: string;

    /**
     * Creates a new FirestoreSaltStore instance.
     *
     * @param projectId - The Google Cloud project ID
     * @param databaseId - The Firestore database ID (for named databases)
     * @param collectionName - The name of the Firestore collection to use (default: 'salts')
     */
    constructor(projectId: string, databaseId: string, collectionName: string = 'salts') {
        // Initialize Firestore client
        // If FIRESTORE_EMULATOR_HOST is set, it will automatically connect to the emulator
        const firestoreConfig: {projectId: string; databaseId: string} = {
            projectId,
            databaseId
        };
        
        this.firestore = new Firestore(firestoreConfig);
        this.collectionName = collectionName;
        
        // Perform a basic health check to fail fast if Firestore is unavailable
        this.healthCheck();
    }

    /**
     * Performs a basic health check to verify Firestore connectivity.
     * This helps fail fast during initialization if Firestore is unavailable.
     */
    private async healthCheck(): Promise<void> {
        try {
            // Simple operation to test connectivity - just get the collection reference
            await this.firestore.collection(this.collectionName).limit(1).get();
        } catch (error) {
            // Log warning but don't throw - allow graceful degradation
            logger.warn({event: 'FirestoreSaltStoreHealthCheckFailed', error});
        }
    }

    /**
     * Retrieves a salt record from Firestore.
     *
     * @param key - The unique key for the salt
     * @returns The salt record if found, undefined if not found
     */
    async get(key: string): Promise<SaltRecord | undefined> {
        try {
            const doc = await this.firestore
                .collection(this.collectionName)
                .doc(key)
                .get();

            if (!doc.exists) {
                return undefined;
            }

            const data = doc.data();
            if (!data) {
                return undefined;
            }

            // Convert Firestore Timestamp to Date
            const createdAt = data.created_at?.toDate ? data.created_at.toDate() : new Date(data.created_at);

            return {
                salt: data.salt,
                created_at: createdAt
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Retrieves all salt records from Firestore.
     *
     * @returns A record of key to salt record
     */
    async getAll(): Promise<Record<string, SaltRecord>> {
        try {
            const snapshot = await this.firestore
                .collection(this.collectionName)
                .get();

            const records: Record<string, SaltRecord> = {};

            for (const doc of snapshot.docs) {
                const data = doc.data();
                if (!data) {
                    continue;
                }

                // Convert Firestore Timestamp to Date
                const createdAt = data.created_at?.toDate ? data.created_at.toDate() : new Date(data.created_at);

                records[doc.id] = {
                    salt: data.salt,
                    created_at: createdAt
                };
            }

            return records;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Stores a salt record in Firestore.
     *
     * @param key - The unique key for the salt
     * @param salt - The salt value to store
     * @returns The created salt record
     * @throws Error if the key already exists
     */
    async set(key: string, salt: string): Promise<SaltRecord> {
        try {
            const docRef = this.firestore.collection(this.collectionName).doc(key);
            const now = new Date();

            const record: SaltRecord = {
                salt,
                created_at: now
            };

            // Use create() for atomic operation - fails if document exists
            await docRef.create(record);

            return {
                salt,
                created_at: now
            };
        } catch (error) {
            // Firestore throws a specific error when document already exists
            if (error instanceof Error && 'code' in error) {
                const errorWithCode = error as Error & { code: string | number };
                if (error.message?.includes('already exists') || errorWithCode.code === 'ALREADY_EXISTS') {
                    throw new SaltAlreadyExistsError(key);
                }
            }
            throw error;
        }
    }

    /**
     * Deletes a salt record from Firestore.
     *
     * @param key - The unique key for the salt to delete
     */
    async delete(key: string): Promise<void> {
        try {
            await this.firestore
                .collection(this.collectionName)
                .doc(key)
                .delete();
        } catch (error) {
            throw error;
        }
    }

    /**
     * Clears all documents in the collection.
     * WARNING: This deletes all data! Use with caution, primarily for testing.
     */
    async clear(): Promise<void> {
        const collection = this.firestore.collection(this.collectionName);
        const snapshot = await collection.get();
        
        if (snapshot.size === 0) {
            return;
        }

        const batch = this.firestore.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
    }

    /**
     * Delete all salts from before today (UTC)
     * @returns Number of salts deleted
     */
    async cleanup(): Promise<number> {
        try {
            // Get today's date in UTC (same logic as UserSignatureService)
            const today = new Date().toISOString().split('T')[0];
            const cutoffDate = new Date(today); // This will be midnight UTC of today
            
            const snapshot = await this.firestore
                .collection(this.collectionName)
                .where('created_at', '<', cutoffDate)
                .get();

            if (snapshot.size === 0) {
                return 0;
            }

            const batch = this.firestore.batch();
            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            return snapshot.size;
        } catch (error) {
            logger.error({event: 'FirestoreSaltStoreCleanupFailed', error});
            throw error;
        }
    }

    /**
     * Get the salt for a given key, or create it if it doesn't exist.
     * Uses a read-first approach optimized for the common case where salts already exist.
     * Most requests will hit the fast read path; only the first request per day per site needs creation.
     *
     * @param key - The key to get or create the salt for
     * @param saltGenerator - Function to generate the salt if needed (only called when creating)
     * @returns The salt for the given key (existing or newly created)
     */
    async getOrCreate(key: string, saltGenerator: () => string): Promise<SaltRecord> {
        // Fast path: try to read first (most common case - salt already exists)
        const existingSalt = await this.get(key);
        if (existingSalt) {
            return existingSalt;
        }
        
        // Document doesn't exist, create it (rare case - first request of the day for this site)
        const newSalt = saltGenerator();
        
        try {
            // Use existing set method which handles atomic creation
            return await this.set(key, newSalt);
        } catch (error) {
            // Handle race condition: another process created the document between our read and create
            // We could do this with a transaction, but it adds unnecessary performance overhead
            if (error instanceof SaltAlreadyExistsError) {
                // Another process created it, read and return the existing document
                const freshSalt = await this.get(key);
                if (!freshSalt) {
                    throw new Error(`Document should exist but was not found after race condition for key: ${key}`);
                }
                return freshSalt;
            }
            
            // Re-throw other errors
            logger.error({event: 'FirestoreSaltStoreGetOrCreateFailed', error});
            throw error;
        }
    }
}
