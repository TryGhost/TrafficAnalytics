export interface SaltRecord {
    salt: string;
    created_at: Date;
}

export interface ISaltStore {
    /**
     * Get the salt for a given key
     * @param key - The key to get the salt for
     * @returns The salt for the given key
     */
    get(key: string): Promise<SaltRecord>;

    /**
     * Get all salts
     * @returns A record of key to salt
     */
    getAll(): Promise<Record<string, SaltRecord>>;

    /**
     * Set the salt for a given key
     * @param key - The key to set the salt for
     * @param salt - The salt to set for the given key
     */
    set(key: string, salt: string): Promise<SaltRecord>;

    /**
     * Delete the salt for a given key
     * @param key - The key to delete the salt for
     */
    delete(key: string): Promise<void>;
};
