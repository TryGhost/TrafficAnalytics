import type {ISaltStore} from './ISaltStore';
import {MemorySaltStore} from './MemorySaltStore';
import {FirestoreSaltStore} from './FirestoreSaltStore';

export type SaltStoreType = 'memory' | 'file' | 'firestore';

export type SaltStoreConfig = {
    type: SaltStoreType;
    filePath?: string;
    projectId?: string;
    databaseId?: string;
    collectionName?: string;
};

export function createSaltStore(config?: SaltStoreConfig): ISaltStore {
    const storeType = config?.type || (process.env.SALT_STORE_TYPE as SaltStoreType) || 'memory';

    switch (storeType) {
    case 'memory':
        return new MemorySaltStore();
    case 'firestore': {
        const projectId = config?.projectId || process.env.GOOGLE_CLOUD_PROJECT;
        const databaseId = config?.databaseId || process.env.FIRESTORE_DATABASE_ID;
        
        if (!projectId) {
            throw new Error('Firestore project ID is required. Provide it via config.projectId or GOOGLE_CLOUD_PROJECT environment variable');
        }
        
        if (!databaseId) {
            throw new Error('Firestore database ID is required. Provide it via config.databaseId or FIRESTORE_DATABASE_ID environment variable');
        }
        
        return new FirestoreSaltStore(projectId, databaseId, config?.collectionName);
    }
    case 'file':
        throw new Error('File salt store is not implemented yet');
    default:
        throw new Error(`Unknown salt store type: ${storeType}`);
    }
}
