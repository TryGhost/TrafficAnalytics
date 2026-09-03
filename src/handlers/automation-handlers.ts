import type {FastifyReply, FastifyRequest} from 'fastify';
import {TinybirdClient} from '../services/tinybird/client';
import {
    AutomationRequestBodySchema,
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

export const handleAutomationRequestStrategyBatch = async (request: AutomationRequest, reply: FastifyReply): Promise<void> => {
    const events = Array.isArray(request.body) ? request.body : [request.body];

    const results = await Promise.allSettled(events.map(event => publishAutomationEvent(request, event)));
    const errors = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map(result => result.reason);

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
