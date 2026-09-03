import type {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';
import AutomationBatchWorker, {type AutomationTinybirdClients} from '../services/automation-worker/AutomationBatchWorker';
import {AUTOMATION_EVENT_DATASOURCES} from '../services/tinybird/automation';
import {TinybirdClient} from '../services/tinybird/client';

async function automationWorkerPlugin(fastify: FastifyInstance) {
    let automationWorker: AutomationBatchWorker | null = null;

    fastify.ready(() => {
        const apiUrl = process.env.PROXY_TARGET;
        const apiToken = process.env.TINYBIRD_TRACKER_TOKEN;
        const subscriptionName = process.env.PUBSUB_SUBSCRIPTION_AUTOMATION_EVENTS;

        if (!apiUrl || !apiToken || !subscriptionName) {
            throw new Error('Automation worker requires PROXY_TARGET, TINYBIRD_TRACKER_TOKEN, and PUBSUB_SUBSCRIPTION_AUTOMATION_EVENTS');
        }

        const clientConfig = {
            apiUrl,
            apiToken,
            wait: process.env.TINYBIRD_WAIT === 'true'
        };
        const tinybirdClients: AutomationTinybirdClients = {
            automation_runs: new TinybirdClient({
                ...clientConfig,
                datasource: AUTOMATION_EVENT_DATASOURCES.automation_runs
            }),
            automation_run_steps: new TinybirdClient({
                ...clientConfig,
                datasource: AUTOMATION_EVENT_DATASOURCES.automation_run_steps
            })
        };

        automationWorker = new AutomationBatchWorker(subscriptionName, tinybirdClients);
        automationWorker.start();
        fastify.log.info({event: 'AutomationWorkerStarted'});
    });

    fastify.addHook('onClose', async () => {
        if (automationWorker) {
            await automationWorker.stop();
        }
    });
}

export default fp(automationWorkerPlugin);
