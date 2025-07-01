import {FastifyReply} from 'fastify';
import {PageHitRequestType} from '../schemas';
import {publishPageHitRaw} from '../plugins/proxy';

export const handlePageHitRequestStrategyBatch = async (request: PageHitRequestType, reply: FastifyReply): Promise<void> => {
    try {
        await publishPageHitRaw(request);
        reply.status(202).send({message: 'Page hit event received'});
    } catch (error) {
        request.log.error({
            err: error instanceof Error ? {
                message: error.message,
                stack: error.stack,
                name: error.name
            } : error,
            httpRequest: {
                requestMethod: request.method,
                requestUrl: request.url,
                userAgent: request.headers['user-agent'],
                remoteIp: request.ip,
                referer: request.headers.referer,
                protocol: `${request.protocol.toUpperCase()}/${request.raw.httpVersion}`,
                status: 500
            },
            type: 'batch_processing_error'
        }, 'Failed to publish page hit event to batch queue');
        reply.status(500).send({error: 'Failed to process page hit event'});
    }
};
