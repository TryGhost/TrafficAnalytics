import type {ISaltStore} from './ISaltStore';
import {MemorySaltStore} from './MemorySaltStore';
import {FirestoreSaltStore} from './FirestoreSaltStore';
import {FileSaltStore} from './FileSaltStore';

export type SaltStoreType = 'memory' | 'file' | 'firestore';

export type SaltStoreConfig = {
    type: SaltStoreType;
    filePath?: string;
    projectId?: string;
    databaseId?: string;
    collectionName?: string;
};

export function createSaltStore(saltStoreConfig?: SaltStoreConfig): ISaltStore {
    const storeType = saltStoreConfig?.type || (process.env.SALT_STORE_TYPE as SaltStoreType) || 'memory';

    switch (storeType) {
    case 'memory':
        return new MemorySaltStore();
    case 'firestore': {
        const projectId = saltStoreConfig?.projectId || process.env.GOOGLE_CLOUD_PROJECT;
        const databaseId = saltStoreConfig?.databaseId || process.env.FIRESTORE_DATABASE_ID;
        
        if (!projectId) {
            throw new Error('Firestore project ID is required. Provide it via config.projectId or GOOGLE_CLOUD_PROJECT environment variable');
        }
        
        if (!databaseId) {
            throw new Error('Firestore database ID is required. Provide it via config.databaseId or FIRESTORE_DATABASE_ID environment variable');
        }
        
        return new FirestoreSaltStore(projectId, databaseId, saltStoreConfig?.collectionName);
    }
    case 'file': {
        const filePath = saltStoreConfig?.filePath || process.env.SALT_STORE_FILE_PATH || './data/salts.json';
        return new FileSaltStore(filePath);
    }
    default:
        throw new Error(`Unknown salt store type: ${storeType}`);
    }
}
