import type {ISaltStore} from './ISaltStore';
import {MemorySaltStore} from './MemorySaltStore';

export type SaltStoreType = 'memory' | 'file';

export type SaltStoreConfig = {
    type: SaltStoreType;
    filePath?: string;
};

export function createSaltStore(config?: SaltStoreConfig): ISaltStore {
    const storeType = config?.type || 'memory';

    switch (storeType) {
    case 'memory':
        return new MemorySaltStore();
    case 'file':
        throw new Error('File salt store is not implemented yet');
    default:
        throw new Error(`Unknown salt store type: ${storeType}`);
    }
}
