import type {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';

async function automationWorkerPlugin(fastify: FastifyInstance) {
    let heartbeatInterval: NodeJS.Timeout | null = null;

    fastify.addHook('onReady', async () => {
        fastify.log.info({event: 'AutomationWorkerStarted'});

        heartbeatInterval = setInterval(() => {
            fastify.log.info({event: 'AutomationWorkerHeartbeat'});
        }, 10000);
    });

    fastify.addHook('onClose', async () => {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
    });
}

export default fp(automationWorkerPlugin);
