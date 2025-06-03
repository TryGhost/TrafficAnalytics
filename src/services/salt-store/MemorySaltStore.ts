import type {ISaltStore} from './ISaltStore';
import {SaltRecord} from '../../types';

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

    async set(key: string, salt: string): Promise<void> {
        this.salts[key] = {salt, created_at: new Date()};
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
}
