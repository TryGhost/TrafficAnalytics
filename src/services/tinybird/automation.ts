import type {AutomationEvent} from '../../schemas';

export const AUTOMATION_EVENT_DATASOURCES = {
    automation_runs: 'automation_run_events',
    automation_run_steps: 'automation_run_step_events'
} satisfies Record<AutomationEvent['type'], string>;

export const AUTOMATION_EVENT_TYPES = Object.keys(AUTOMATION_EVENT_DATASOURCES) as AutomationEvent['type'][];
