import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';
import BatchWorker from '../services/batch-worker/BatchWorker';
import {TinybirdClient} from '../services/tinybird/client';

async function workerPlugin(fastify: FastifyInstance) {
    let batchWorker: BatchWorker | null = null;
    let heartbeatInterval: NodeJS.Timeout | null = null;

    // Start the worker process before the app starts listening for requests
    // app.listen() will run after all .ready() hooks have completed
    fastify.ready(() => {
        fastify.log.info('Worker app started - beginning heartbeat logging');
        
        // Log heartbeat every 10 seconds
        heartbeatInterval = setInterval(() => {
            fastify.log.info('Worker heartbeat - processing events...');
        }, 10000);

        const tinybirdClient = new TinybirdClient({
            apiUrl: process.env.PROXY_TARGET as string,
            apiToken: process.env.TINYBIRD_TRACKER_TOKEN as string,
            datasource: 'analytics_events_test'
        });

        batchWorker = new BatchWorker(process.env.PUBSUB_SUBSCRIPTION_PAGE_HITS_RAW as string, tinybirdClient);
        batchWorker.start();
    });

    // Clean up resources when the app is closing
    fastify.addHook('onClose', async () => {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
        if (batchWorker) {
            await batchWorker.stop();
        }
    });
}

export default fp(workerPlugin);