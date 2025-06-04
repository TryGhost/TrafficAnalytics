export interface SaltRecord {
    salt: string;
    created_at: Date;
}

export interface ISaltStore {
    /**
     * Get the salt for a given key
     * @param key - The key to get the salt for
     * @returns The salt for the given key, or undefined if not found
     */
    get(key: string): Promise<SaltRecord | undefined>;

    /**
     * Get all salts
     * @returns A record of key to salt
     */
    getAll(): Promise<Record<string, SaltRecord>>;

    /**
     * Set the salt for a given key
     * @param key - The key to set the salt for
     * @param salt - The salt to set for the given key
     * @throws Error if the key already exists
     */
    set(key: string, salt: string): Promise<SaltRecord>;

    /**
     * Delete the salt for a given key
     * @param key - The key to delete the salt for
     */
    delete(key: string): Promise<void>;

    /**
     * Clear all salts from the store
     * WARNING: This deletes all data! Use with caution, primarily for testing.
     */
    clear(): Promise<void>;
};
