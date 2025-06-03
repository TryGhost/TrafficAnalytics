export interface SaltRecord {
    salt: string;
    created_at: Date;
}

export interface ISaltStore {
    /**
     * Get the salt for a given site_uuid
     * @param key - The site_uuid to get the salt for
     * @returns The salt for the given site_uuid
     */
    get(key: string): Promise<SaltRecord>;

    /**
     * Get all salts
     * @returns A record of site_uuid to salt
     */
    getAll(): Promise<Record<string, SaltRecord>>;

    /**
     * Set the salt for a given site_uuid
     * @param key - The site_uuid to set the salt for
     * @param salt - The salt to set for the given site_uuid
     */
    set(key: string, salt: string): Promise<void>;
};
