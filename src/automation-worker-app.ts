import fastify from 'fastify';
import loggingPlugin from './plugins/logging';
import automationWorkerPlugin from './plugins/automation-worker-plugin';
import {getLoggerConfig} from './utils/logger-config';
import {fastifyOtelInstrumentation} from './utils/fastify-otel';

const app = fastify({
    logger: getLoggerConfig(),
    disableRequestLogging: true,
    trustProxy: process.env.TRUST_PROXY !== 'false'
});

app.register(fastifyOtelInstrumentation.plugin());
app.register(loggingPlugin);
app.register(automationWorkerPlugin);

app.get('/', async () => {
    return {status: 'automation-worker-healthy'};
});

app.get('/health', async () => {
    return {status: 'automation-worker-healthy'};
});

export default app;
