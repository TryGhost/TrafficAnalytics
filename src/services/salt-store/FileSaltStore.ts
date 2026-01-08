import {promises as fs} from 'fs';
import * as path from 'path';
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
 * File-based implementation of the salt store.
 *
 * Stores salts in a JSON file on the filesystem. Salts are keyed by date,
 * so they naturally rotate daily without needing explicit expiration.
 * 
 * This implementation is suitable for self-hosted installations that don't
 * have access to cloud services like Firestore.
 */
export class FileSaltStore implements ISaltStore {
    private readonly filePath: string;
    private fileOperationPromise: Promise<void> = Promise.resolve();
    private initPromise: Promise<void>;
    private pendingCreations: Map<string, Promise<SaltRecord>> = new Map();

    /**
     * Creates a new FileSaltStore instance.
     *
     * @param filePath - The path to the JSON file where salts will be stored
     */
    constructor(filePath: string = './data/salts.json') {
        this.filePath = path.resolve(filePath);
        this.initPromise = this.initializeFile();
    }

    /**
     * Ensures the directory and file exist.
     */
    private async initializeFile(): Promise<void> {
        try {
            const dir = path.dirname(this.filePath);
            await fs.mkdir(dir, {recursive: true});
            
            try {
                await fs.access(this.filePath);
            } catch {
                // File doesn't exist, create it with empty object
                await this.writeFile({});
            }
        } catch (error) {
            logger.warn({event: 'FileSaltStoreInitializationFailed', error});
        }
    }

    /**
     * Reads the salt data from the file.
     */
    private async readFile(): Promise<Record<string, SaltRecord>> {
        try {
            const data = await fs.readFile(this.filePath, 'utf-8');
            const parsed = JSON.parse(data);
            
            // Convert created_at strings back to Date objects
            const records: Record<string, SaltRecord> = {};
            for (const [key, value] of Object.entries(parsed)) {
                if (typeof value === 'object' && value !== null && 'salt' in value && 'created_at' in value) {
                    const recordData = value as {salt: string; created_at: string};
                    records[key] = {
                        salt: recordData.salt,
                        created_at: new Date(recordData.created_at)
                    };
                }
            }
            return records;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return {};
            }
            // Handle corrupted file
            logger.error({event: 'FileSaltStoreReadFailed', error});
            await this.writeFile({});
            return {};
        }
    }

    /**
     * Writes salt data to the file atomically.
     */
    private async writeFile(data: Record<string, SaltRecord>): Promise<void> {
        const tempPath = `${this.filePath}.tmp`;
        
        // Convert Date objects to ISO strings for JSON serialization
        const serializable: Record<string, {salt: string; created_at: string}> = {};
        for (const [key, value] of Object.entries(data)) {
            serializable[key] = {
                salt: value.salt,
                created_at: value.created_at.toISOString()
            };
        }
        
        await fs.writeFile(tempPath, JSON.stringify(serializable, null, 2), 'utf-8');
        await fs.rename(tempPath, this.filePath);
    }

    /**
     * Executes a file operation with queuing to prevent concurrent writes.
     */
    private async executeFileOperation<T>(operation: () => Promise<T>): Promise<T> {
        // Queue operations to prevent concurrent file access issues
        const currentOperation = this.fileOperationPromise.then(operation);
        this.fileOperationPromise = currentOperation.then(() => {}, () => {});
        return currentOperation;
    }

    /**
     * Retrieves a salt record from the file.
     *
     * @param key - The unique key for the salt
     * @returns The salt record if found, undefined if not found
     */
    async get(key: string): Promise<SaltRecord | undefined> {
        await this.initPromise;
        const data = await this.readFile();
        const record = data[key];
        
        if (!record) {
            return undefined;
        }
        
        // Return a copy to prevent external modifications
        return {
            salt: record.salt,
            created_at: new Date(record.created_at)
        };
    }

    /**
     * Retrieves all salt records from the file.
     *
     * @returns A record of key to salt record
     */
    async getAll(): Promise<Record<string, SaltRecord>> {
        await this.initPromise;
        const data = await this.readFile();
        
        // Return a deep copy to prevent external modifications
        const copy: Record<string, SaltRecord> = {};
        for (const [key, record] of Object.entries(data)) {
            copy[key] = {
                salt: record.salt,
                created_at: new Date(record.created_at)
            };
        }
        
        return copy;
    }

    /**
     * Stores a salt record in the file.
     *
     * @param key - The unique key for the salt
     * @param salt - The salt value to store
     * @returns The created salt record
     * @throws SaltAlreadyExistsError if the key already exists
     */
    async set(key: string, salt: string): Promise<SaltRecord> {
        await this.initPromise;
        return this.executeFileOperation(async () => {
            const data = await this.readFile();
            
            if (data[key]) {
                throw new SaltAlreadyExistsError(key);
            }
            
            const record: SaltRecord = {
                salt,
                created_at: new Date()
            };
            
            data[key] = record;
            await this.writeFile(data);
            
            return {
                salt: record.salt,
                created_at: new Date(record.created_at)
            };
        });
    }

    /**
     * Deletes a salt record from the file.
     *
     * @param key - The unique key for the salt to delete
     */
    async delete(key: string): Promise<void> {
        await this.initPromise;
        await this.executeFileOperation(async () => {
            const data = await this.readFile();
            delete data[key];
            await this.writeFile(data);
        });
    }

    /**
     * Clears all salts from the file.
     * WARNING: This deletes all data! Use with caution, primarily for testing.
     */
    async clear(): Promise<void> {
        await this.initPromise;
        await this.executeFileOperation(async () => {
            await this.writeFile({});
        });
    }

    /**
     * Delete all salts from days before today (UTC)
     * @returns Number of salts deleted
     */
    async cleanup(): Promise<number> {
        await this.initPromise;
        return this.executeFileOperation(async () => {
            try {
                // Get today's date in UTC (same logic as UserSignatureService)
                const today = new Date().toISOString().split('T')[0];
                const cutoffDate = new Date(today); // This will be midnight UTC of today
                
                const data = await this.readFile();
                let deletedCount = 0;
                
                for (const [key, record] of Object.entries(data)) {
                    if (record.created_at < cutoffDate) {
                        delete data[key];
                        deletedCount += 1;
                    }
                }
                
                if (deletedCount > 0) {
                    await this.writeFile(data);
                }
                
                return deletedCount;
            } catch (error) {
                logger.error({event: 'FileSaltStoreCleanupFailed', error});
                throw error;
            }
        });
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
        await this.initPromise;
        // Fast path: try to read first (most common case - salt already exists)
        const existingSalt = await this.get(key);
        if (existingSalt) {
            return existingSalt;
        }
        
        // Check if there's already a pending creation for this key
        const pendingCreation = this.pendingCreations.get(key);
        if (pendingCreation) {
            return pendingCreation;
        }
        
        // Create a promise for this creation operation
        const creationPromise = this.executeFileOperation(async () => {
            // Re-read inside the queued operation to handle race conditions
            const data = await this.readFile();
            
            // Check again in case another process created it
            if (data[key]) {
                return {
                    salt: data[key].salt,
                    created_at: new Date(data[key].created_at)
                };
            }
            
            // Create new record - only call saltGenerator here
            const record: SaltRecord = {
                salt: saltGenerator(),
                created_at: new Date()
            };
            
            data[key] = record;
            await this.writeFile(data);
            
            return {
                salt: record.salt,
                created_at: new Date(record.created_at)
            };
        }).finally(() => {
            // Clean up the pending creation once it's done
            this.pendingCreations.delete(key);
        });
        
        // Store the pending creation
        this.pendingCreations.set(key, creationPromise);
        
        return creationPromise;
    }
}
