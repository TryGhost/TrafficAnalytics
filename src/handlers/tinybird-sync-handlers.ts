import type {FastifyReply, FastifyRequest} from 'fastify';
import type {TinybirdSyncRequestBody} from '../schemas';
import {publishTinybirdSyncEvent} from '../services/events/publisherUtils';
import {TinybirdClient} from '../services/tinybird/client';
import {TINYBIRD_SYNC_EVENT_DATASOURCES} from '../services/tinybird/tinybird-sync';

export type TinybirdSyncRequest = FastifyRequest<{Body: TinybirdSyncRequestBody}>;

export const handleTinybirdSyncRequestStrategyBatch = async (request: TinybirdSyncRequest): Promise<void> => {
    const results = await Promise.allSettled(request.body.map(event => publishTinybirdSyncEvent(request, event)));
    const errors = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map(result => result.reason);

    if (errors.length > 0) {
        throw new AggregateError(errors, 'Failed to publish Tinybird sync events');
    }
};

export const handleTinybirdSyncRequestStrategyInline = async (request: TinybirdSyncRequest): Promise<void> => {
    const apiUrl = process.env.PROXY_TARGET;
    const apiToken = process.env.TINYBIRD_TRACKER_TOKEN;

    if (!apiUrl || !apiToken) {
        throw new Error('Tinybird sync endpoint requires PROXY_TARGET and TINYBIRD_TRACKER_TOKEN');
    }

    const clients = new Map<string, TinybirdClient>();

    for (const event of request.body) {
        const {type, ...payload} = event;
        const datasource = TINYBIRD_SYNC_EVENT_DATASOURCES[type];
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
};

export const tinybirdSyncRequestHandler = async (request: TinybirdSyncRequest, reply: FastifyReply): Promise<void> => {
    try {
        if (process.env.PUBSUB_TOPIC_TINYBIRD_SYNC) {
            await handleTinybirdSyncRequestStrategyBatch(request);
        } else {
            await handleTinybirdSyncRequestStrategyInline(request);
        }
        reply.status(202).send();
    } catch (err) {
        request.log.error({
            event: 'TinybirdSyncRequestProcessingError',
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
        reply.status(500).send({error: 'Failed to process Tinybird sync events'});
    }
};
