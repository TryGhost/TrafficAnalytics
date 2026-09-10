import fastify, {LogController} from 'fastify';
import loggingPlugin from './plugins/logging';
import tinybirdSyncWorkerPlugin from './plugins/tinybird-sync-worker-plugin';
import {getLoggerConfig} from './utils/logger-config';
import {fastifyOtelInstrumentation} from './utils/fastify-otel';

const app = fastify({
    logger: getLoggerConfig(),
    logController: new LogController({disableRequestLogging: true}),
    trustProxy: process.env.TRUST_PROXY !== 'false'
});

app.register(fastifyOtelInstrumentation.plugin());
app.register(loggingPlugin);
app.register(tinybirdSyncWorkerPlugin);

app.get('/', async () => {
    return {status: 'tinybird-sync-healthy'};
});

app.get('/health', async () => {
    return {status: 'tinybird-sync-healthy'};
});

export default app;
