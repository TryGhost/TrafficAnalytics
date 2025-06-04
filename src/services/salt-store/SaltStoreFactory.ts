import type {ISaltStore} from './ISaltStore';
import {MemorySaltStore} from './MemorySaltStore';
import {FirestoreSaltStore} from './FirestoreSaltStore';

export type SaltStoreType = 'memory' | 'file' | 'firestore';

export type SaltStoreConfig = {
    type: SaltStoreType;
    filePath?: string;
    projectId?: string;
    collectionName?: string;
};

export function createSaltStore(config?: SaltStoreConfig): ISaltStore {
    const storeType = config?.type || (process.env.SALT_STORE_TYPE as SaltStoreType) || 'memory';

    switch (storeType) {
    case 'memory':
        return new MemorySaltStore();
    case 'firestore':
        return new FirestoreSaltStore(config?.projectId, config?.collectionName);
    case 'file':
        throw new Error('File salt store is not implemented yet');
    default:
        throw new Error(`Unknown salt store type: ${storeType}`);
    }
}
