import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';
import {isBot} from '../utils/bot-detection';
import {PAGE_HIT_ACCEPTED_RESPONSE} from '../utils/page-hit-response';

async function botDetectionPlugin(fastify: FastifyInstance) {
    fastify.addHook('preHandler', async (request, reply) => {
        const userAgent = request.headers['user-agent'];
        if (typeof userAgent !== 'string' || !isBot(userAgent)) {
            return;
        }

        request.log.info({
            event: 'BotEventFiltered',
            httpRequest: {
                requestMethod: request.method,
                requestUrl: request.url,
                userAgent,
                remoteIp: request.ip
            }
        });

        if (process.env.ENABLE_BOT_DETECTION_HEADER === 'true') {
            reply.header('x-ghost-bot-detected', 'true');
        }

        return reply.status(202).send(PAGE_HIT_ACCEPTED_RESPONSE);
    });
}

export default fp(botDetectionPlugin, {
    name: 'bot-detection'
});
