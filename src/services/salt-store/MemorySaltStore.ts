import type {ISaltStore, SaltRecord} from './ISaltStore';

export class MemorySaltStore implements ISaltStore {
    private readonly salts: Record<string, SaltRecord> = {};

    async getAll(): Promise<Record<string, SaltRecord>> {
        const copy: Record<string, SaltRecord> = {};
        for (const [key, record] of Object.entries(this.salts)) {
            copy[key] = {
                salt: record.salt,
                created_at: new Date(record.created_at)
            };
        }
        return copy;
    }

    async set(key: string, salt: string): Promise<SaltRecord> {
        if (this.salts[key]) {
            throw new Error(`Salt for key "${key}" already exists`);
        }
        this.salts[key] = {salt, created_at: new Date()};
        return this.salts[key];
    }

    async get(key: string): Promise<SaltRecord> {
        const record = this.salts[key];
        if (!record) {
            return record;
        }
        return {
            salt: record.salt,
            created_at: new Date(record.created_at)
        };
    }

    async delete(key: string): Promise<void> {
        delete this.salts[key];
    }
}
