import type {FastifyReply, FastifyRequest} from 'fastify';
import {TinybirdClient} from '../services/tinybird/client';
import {
    AutomationRequestBodySchema,
    type AutomationEvent,
    type AutomationRequestBody
} from '../schemas';

export const GHOST_TABLE_TO_TINYBIRD_DATASOURCE = {
    automation_runs: 'automation_run_events',
    automation_run_steps: 'automation_run_step_events'
} satisfies Record<AutomationEvent['type'], string>;

type AutomationRequest = FastifyRequest<{Body: AutomationRequestBody}>;

export const automationRequestHandler = async (request: AutomationRequest, reply: FastifyReply): Promise<void> => {
    const events = Array.isArray(request.body) ? request.body : [request.body];
    const apiUrl = process.env.PROXY_TARGET;
    const apiToken = process.env.TINYBIRD_TRACKER_TOKEN;

    if (!apiUrl || !apiToken) {
        throw new Error('Automation endpoint requires PROXY_TARGET and TINYBIRD_TRACKER_TOKEN');
    }

    const clients = new Map<string, TinybirdClient>();

    for (const event of events) {
        const {type, ...payload} = event;
        const datasource = GHOST_TABLE_TO_TINYBIRD_DATASOURCE[type];
        let client = clients.get(datasource);
        if (!client) {
            client = new TinybirdClient({
                apiUrl,
                apiToken,
                datasource,
                wait: process.env.TINYBIRD_WAIT === 'true'
            });
            clients.set(datasource, client);
        }

        await client.postEvent(payload);
    }

    reply.status(202).send();
};

export const automationRouteOptions = {
    bodyLimit: 10 * 1024 * 1024,
    schema: {
        body: AutomationRequestBodySchema
    },
    handler: automationRequestHandler
};
