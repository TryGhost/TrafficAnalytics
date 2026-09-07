import type {FastifyReply, FastifyRequest} from 'fastify';
import {TinybirdClient} from '../services/tinybird/client';
import {
    AutomationRequestBodySchema,
    type AutomationEvent,
    type AutomationEventChunk,
    type AutomationRequestBody
} from '../schemas';
import {publishAutomationChunk} from '../services/events/publisherUtils';
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
const DEFAULT_CHUNK_SIZE = 500;

const positiveIntFromEnv = (name: string, fallback: number): number => {
    const configured = parseInt(process.env[name] || '', 10);
    return configured > 0 ? configured : fallback;
};

const publishConcurrency = (): number => positiveIntFromEnv('AUTOMATION_PUBLISH_CONCURRENCY', DEFAULT_PUBLISH_CONCURRENCY);
const chunkSize = (): number => positiveIntFromEnv('AUTOMATION_CHUNK_SIZE', DEFAULT_CHUNK_SIZE);

// Groups events by type, preserving order within a type, and slices each group into
// chunks so one Pub/Sub message carries many rows for one datasource.
export function chunkAutomationEvents(events: AutomationEvent[], size: number): AutomationEventChunk[] {
    const chunks: AutomationEventChunk[] = [];
    const open = new Map<AutomationEvent['type'], AutomationEventChunk>();

    for (const {type, ...event} of events) {
        let chunk = open.get(type);
        if (!chunk) {
            chunk = {type, events: []} as unknown as AutomationEventChunk;
            open.set(type, chunk);
            chunks.push(chunk);
        }
        (chunk.events as typeof event[]).push(event);
        if (chunk.events.length >= size) {
            open.delete(type);
        }
    }

    return chunks;
}

// Publishes every chunk, at most `limit` at a time, and collects the failures instead
// of stopping at the first one so the caller can report how many were lost.
async function publishAll(items: AutomationEventChunk[], limit: number, publish: (item: AutomationEventChunk) => Promise<void>): Promise<unknown[]> {
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

    const chunks = chunkAutomationEvents(events, chunkSize());
    const errors = await publishAll(chunks, publishConcurrency(), chunk => publishAutomationChunk(request, chunk));

    if (errors.length > 0) {
        throw new AggregateError(errors, 'Failed to publish one or more automation event chunks');
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
