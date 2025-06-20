import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';

async function workerPlugin(fastify: FastifyInstance) {
    // Start heartbeat logging when the app is ready
    fastify.ready(() => {
        fastify.log.info('Worker app started - beginning heartbeat logging');
        
        // Log heartbeat every 10 seconds
        setInterval(() => {
            fastify.log.info('Worker heartbeat - processing events...');
        }, 10000);
    });
}

export default fp(workerPlugin);