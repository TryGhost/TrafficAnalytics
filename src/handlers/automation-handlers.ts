import type {FastifyReply, FastifyRequest} from 'fastify';
import {TinybirdClient, type TinybirdEvent} from '../services/tinybird/client';

export const GHOST_TABLE_TO_TINYBIRD_DATASOURCE = {
    automation_runs: 'automation_run_events',
    automation_run_steps: 'automation_run_step_events'
} as const;

type GhostTable = keyof typeof GHOST_TABLE_TO_TINYBIRD_DATASOURCE;

type RoutedAutomationEvent = {
    datasource: string;
    payload: TinybirdEvent;
};

const parseEvent = (value: unknown, lineNumber: number): RoutedAutomationEvent => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`Automation event on line ${lineNumber} must be an object`);
    }

    const event = value as TinybirdEvent;
    const type = event.type;

    if (typeof type !== 'string' || !Object.hasOwn(GHOST_TABLE_TO_TINYBIRD_DATASOURCE, type)) {
        throw new Error(`Unsupported automation event type on line ${lineNumber}: ${String(type)}`);
    }

    const payload = {...event};
    delete payload.type;

    return {
        datasource: GHOST_TABLE_TO_TINYBIRD_DATASOURCE[type as GhostTable],
        payload
    };
};

export const parseAutomationEvents = (body: unknown): RoutedAutomationEvent[] => {
    if (typeof body !== 'string') {
        return [parseEvent(body, 1)];
    }

    return body
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map((line, index) => {
            try {
                return parseEvent(JSON.parse(line), index + 1);
            } catch (err) {
                if (err instanceof SyntaxError) {
                    throw new Error(`Invalid JSON on line ${index + 1}`, {cause: err});
                }
                throw err;
            }
        });
};

export const automationRequestHandler = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // eslint-disable-next-line no-console
    console.log('Automation request body:', request.body);

    let events: RoutedAutomationEvent[];
    try {
        events = parseAutomationEvents(request.body);
    } catch (err) {
        request.log.warn({event: 'AutomationRequestRejected', err});
        reply.status(400).send({error: err instanceof Error ? err.message : 'Invalid automation event payload'});
        return;
    }

    const clients = new Map<string, TinybirdClient>();

    for (const event of events) {
        let client = clients.get(event.datasource);
        if (!client) {
            client = new TinybirdClient({
                apiUrl: process.env.PROXY_TARGET as string,
                apiToken: process.env.TINYBIRD_TRACKER_TOKEN as string,
                datasource: event.datasource,
                wait: process.env.TINYBIRD_WAIT === 'true'
            });
            clients.set(event.datasource, client);
        }

        await client.postEvent(event.payload);
    }

    reply.status(202).send();
};

export const automationRouteOptions = {
    bodyLimit: 10 * 1024 * 1024,
    handler: automationRequestHandler
};
