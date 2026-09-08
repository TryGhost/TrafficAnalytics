import type {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';
import TinybirdSyncBatchWorker, {type TinybirdSyncClients} from '../services/tinybird-sync-worker/TinybirdSyncBatchWorker';
import {TINYBIRD_SYNC_EVENT_DATASOURCES} from '../services/tinybird/tinybird-sync';
import {TinybirdClient} from '../services/tinybird/client';

async function tinybirdSyncWorkerPlugin(fastify: FastifyInstance) {
    let tinybirdSyncWorker: TinybirdSyncBatchWorker | null = null;
    let heartbeatInterval: NodeJS.Timeout | null = null;

    fastify.addHook('onReady', async () => {
        const apiUrl = process.env.PROXY_TARGET;
        const apiToken = process.env.TINYBIRD_TRACKER_TOKEN;
        const subscriptionName = process.env.PUBSUB_SUBSCRIPTION_TINYBIRD_SYNC;

        if (!apiUrl || !apiToken || !subscriptionName) {
            throw new Error('Tinybird sync worker requires PROXY_TARGET, TINYBIRD_TRACKER_TOKEN, and PUBSUB_SUBSCRIPTION_TINYBIRD_SYNC');
        }

        const clientConfig = {
            apiUrl,
            apiToken,
            wait: process.env.TINYBIRD_WAIT === 'true'
        };
        const tinybirdClients: TinybirdSyncClients = {
            automation_runs: new TinybirdClient({
                ...clientConfig,
                datasource: TINYBIRD_SYNC_EVENT_DATASOURCES.automation_runs
            }),
            automation_run_steps: new TinybirdClient({
                ...clientConfig,
                datasource: TINYBIRD_SYNC_EVENT_DATASOURCES.automation_run_steps
            })
        };

        tinybirdSyncWorker = new TinybirdSyncBatchWorker(subscriptionName, tinybirdClients, {
            batchSize: parseInt(process.env.TINYBIRD_SYNC_BATCH_SIZE || '50', 10),
            flushInterval: parseInt(process.env.TINYBIRD_SYNC_BATCH_FLUSH_INTERVAL_MS || '1000', 10)
        });
        tinybirdSyncWorker.start();
        fastify.log.info({event: 'TinybirdSyncWorkerStarted'});
        heartbeatInterval = setInterval(() => {
            fastify.log.info({event: 'TinybirdSyncWorkerHeartbeat'});
        }, 10000);
    });

    fastify.addHook('onClose', async () => {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
        if (tinybirdSyncWorker) {
            await tinybirdSyncWorker.stop();
        }
    });
}

export default fp(tinybirdSyncWorkerPlugin);
