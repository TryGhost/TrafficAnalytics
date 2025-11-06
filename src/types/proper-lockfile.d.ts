declare module 'proper-lockfile' {
    export interface LockOptions {
        retries?: {
            retries?: number;
            minTimeout?: number;
            maxTimeout?: number;
            factor?: number;
            randomize?: boolean;
        };
        stale?: number;
        realpath?: boolean;
        fs?: Record<string, unknown>;
        onCompromised?: (err: Error) => void;
    }

    export interface UnlockOptions {
        realpath?: boolean;
        fs?: Record<string, unknown>;
    }

    export function lock(file: string, options?: LockOptions): Promise<() => Promise<void>>;
    export function unlock(file: string, options?: UnlockOptions): Promise<void>;
    export function check(file: string, options?: LockOptions): Promise<boolean>;
    export function lockSync(file: string, options?: LockOptions): () => void;
    export function unlockSync(file: string, options?: UnlockOptions): void;
    export function checkSync(file: string, options?: LockOptions): boolean;
}
