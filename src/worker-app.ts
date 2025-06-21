// Worker module file
import fastify from 'fastify';
import loggingPlugin from './plugins/logging';
import workerPlugin from './plugins/worker-plugin';
import {getLoggerConfig} from './utils/logger';

const app = fastify({
    logger: getLoggerConfig(),
    disableRequestLogging: true,
    trustProxy: process.env.TRUST_PROXY !== 'false'
});

// Register logging plugin for consistent log formatting
app.register(loggingPlugin);

// Register worker plugin for heartbeat logging
app.register(workerPlugin);

// Health endpoints for Cloud Run deployment
app.get('/', async () => {
    return {status: 'worker-healthy'};
});

app.get('/health', async () => {
    return {status: 'worker-healthy'};
});

export default app;