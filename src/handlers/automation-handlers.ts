import type {FastifyReply, FastifyRequest} from 'fastify';
import {TinybirdClient} from '../services/tinybird/client';
import {
    AutomationRequestBodySchema,
    type AutomationEvent,
    type AutomationRequestBody
} from '../schemas';
import {publishAutomationEvent} from '../services/events/publisherUtils';
import {AUTOMATION_EVENT_DATASOURCES} from '../services/tinybird/automation';

type AutomationRequest = FastifyRequest<{Body: AutomationRequestBody}>;

export const handleAutomationRequestStrategyInline = async (request: AutomationRequest, reply: FastifyReply): Promise<void> => {
    const events = Array.isArray(request.body) ? request.body : [request.body];
    const apiUrl = process.env.PROXY_TARGET;
    const apiToken = process.env.TINYBIRD_TRACKER_TOKEN;

    if (!apiUrl || !apiToken) {
        throw new Error('Automation endpoint requires PROXY_TARGET and TINYBIRD_TRACKER_TOKEN');
    }

    const clients = new Map<string, TinybirdClient>();

    for (const event of events) {
        const {type, ...payload} = event;
        const datasource = AUTOMATION_EVENT_DATASOURCES[type];
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

const DEFAULT_PUBLISH_CONCURRENCY = 100;

const publishConcurrency = (): number => {
    const configured = parseInt(process.env.AUTOMATION_PUBLISH_CONCURRENCY || '', 10);
    return configured > 0 ? configured : DEFAULT_PUBLISH_CONCURRENCY;
};

// Publishes every event, at most `limit` at a time, and collects the failures instead
// of stopping at the first one so the caller can report how many were lost.
async function publishAll(items: AutomationEvent[], limit: number, publish: (item: AutomationEvent) => Promise<void>): Promise<unknown[]> {
    const errors: unknown[] = [];
    let next = 0;
    const workers = Array.from({length: Math.min(limit, items.length)}, async () => {
        while (next < items.length) {
            const item = items[next];
            next += 1;
            try {
                await publish(item);
            } catch (err) {
                errors.push(err);
            }
        }
    });
    await Promise.all(workers);
    return errors;
}

export const handleAutomationRequestStrategyBatch = async (request: AutomationRequest, reply: FastifyReply): Promise<void> => {
    const events = Array.isArray(request.body) ? request.body : [request.body];

    const errors = await publishAll(events, publishConcurrency(), event => publishAutomationEvent(request, event));

    if (errors.length > 0) {
        throw new AggregateError(errors, 'Failed to publish one or more automation events');
    }

    reply.status(202).send();
};

export const automationRequestHandler = async (request: AutomationRequest, reply: FastifyReply): Promise<void> => {
    try {
        if (process.env.PUBSUB_TOPIC_AUTOMATION_EVENTS) {
            await handleAutomationRequestStrategyBatch(request, reply);
        } else {
            await handleAutomationRequestStrategyInline(request, reply);
        }
    } catch (err) {
        request.log.error({
            event: 'AutomationRequestProcessingError',
            err,
            httpRequest: {
                requestMethod: request.method,
                requestUrl: request.url,
                userAgent: request.headers['user-agent'],
                remoteIp: request.ip,
                referer: request.headers.referer,
                protocol: `${request.protocol.toUpperCase()}/${request.raw.httpVersion}`,
                status: 500
            },
            type: 'processing_error'
        });
        reply.status(500).send({error: 'Failed to process automation events'});
    }
};

export const automationRouteOptions = {
    bodyLimit: 10 * 1024 * 1024,
    schema: {
        body: AutomationRequestBodySchema
    },
    handler: automationRequestHandler
};
