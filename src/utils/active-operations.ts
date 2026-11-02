import {performance} from 'node:perf_hooks';

/** Retains only timing information for operations that are still outstanding. */
export class ActiveOperations {
    private starts = new Map<symbol, number>();

    start(): () => void {
        const id = Symbol();
        this.starts.set(id, performance.now());
        return () => {
            this.starts.delete(id);
        };
    }

    snapshot() {
        const oldest = this.starts.values().next().value;
        return {
            count: this.starts.size,
            oldestAgeMs: oldest === undefined ? 0 : performance.now() - oldest
        };
    }
}

export const activePublishes = new ActiveOperations();
