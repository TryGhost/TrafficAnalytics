import type {TinybirdSyncEvent} from '../../schemas';

export const TINYBIRD_SYNC_EVENT_DATASOURCES = {
    automation_runs: 'automation_run_events',
    automation_run_steps: 'automation_run_step_events'
} satisfies Record<TinybirdSyncEvent['type'], string>;

export const TINYBIRD_SYNC_EVENT_TYPES = Object.keys(TINYBIRD_SYNC_EVENT_DATASOURCES) as TinybirdSyncEvent['type'][];
