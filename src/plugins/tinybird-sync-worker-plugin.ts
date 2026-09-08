import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';

async function tinybirdSyncWorkerPlugin(fastify: FastifyInstance) {
    let heartbeatInterval: NodeJS.Timeout | null = null;

    fastify.addHook('onReady', async () => {
        fastify.log.info({event: 'TinybirdSyncWorkerStarted'});

        heartbeatInterval = setInterval(() => {
            fastify.log.info({event: 'TinybirdSyncWorkerHeartbeat'});
        }, 10000);
    });

    fastify.addHook('onClose', async () => {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
    });
}

export default fp(tinybirdSyncWorkerPlugin);
