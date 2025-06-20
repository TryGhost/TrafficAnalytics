// Worker module file
import fastify from 'fastify';
import loggingPlugin from './plugins/logging';
import batchWorkerPlugin from './plugins/batch-worker';
import config from '@tryghost/config';
import {getLoggerConfig} from './utils/logger';

const app = fastify({
    logger: getLoggerConfig(),
    disableRequestLogging: true,
    trustProxy: config.get('TRUST_PROXY') !== 'false'
});

// Register logging plugin for consistent log formatting
app.register(loggingPlugin);

// Register batch worker plugin for Pub/Sub subscription
app.register(batchWorkerPlugin);

// Health endpoints for Cloud Run deployment
app.get('/', async () => {
    return {status: 'worker-healthy'};
});

app.get('/health', async () => {
    return {status: 'worker-healthy'};
});

// Start heartbeat logging immediately when app is ready
app.ready(() => {
    app.log.info('Worker app started - beginning heartbeat logging');
    
    // Log heartbeat every 10 seconds
    setInterval(() => {
        app.log.info('Worker heartbeat - processing events...');
    }, 10000);
});

export default app;