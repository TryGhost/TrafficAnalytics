import type {ISaltStore} from './ISaltStore';
import {MemorySaltStore} from './MemorySaltStore';
import {FirestoreSaltStore} from './FirestoreSaltStore';
import config from '@tryghost/config';

export type SaltStoreType = 'memory' | 'file' | 'firestore';

export type SaltStoreConfig = {
    type: SaltStoreType;
    filePath?: string;
    projectId?: string;
    databaseId?: string;
    collectionName?: string;
};

export function createSaltStore(saltStoreConfig?: SaltStoreConfig): ISaltStore {
    const storeType = saltStoreConfig?.type || (config.get('SALT_STORE_TYPE') as string as SaltStoreType);

    switch (storeType) {
    case 'memory':
        return new MemorySaltStore();
    case 'firestore': {
        const projectId = saltStoreConfig?.projectId || config.get('FIRESTORE_PROJECT_ID') as string;
        const databaseId = saltStoreConfig?.databaseId || config.get('FIRESTORE_DATABASE_ID') as string;
        
        if (!projectId) {
            throw new Error('Firestore project ID is required. Provide it via config.projectId or FIRESTORE_PROJECT_ID environment variable');
        }
        
        if (!databaseId) {
            throw new Error('Firestore database ID is required. Provide it via config.databaseId or FIRESTORE_DATABASE_ID environment variable');
        }
        
        return new FirestoreSaltStore(projectId, databaseId, saltStoreConfig?.collectionName);
    }
    case 'file':
        throw new Error('File salt store is not implemented yet');
    default:
        throw new Error(`Unknown salt store type: ${storeType}`);
    }
}
