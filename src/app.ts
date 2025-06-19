// Main module file
import fastify from 'fastify';
import loggingPlugin from './plugins/logging';
import corsPlugin from './plugins/cors';
import proxyPlugin from './plugins/proxy';
import config from '@tryghost/config';
import {getLoggerConfig} from './utils/logger';

const app = fastify({
    logger: getLoggerConfig(),
    disableRequestLogging: true,
    trustProxy: config.get('TRUST_PROXY') !== 'false'
});

// Register CORS plugin
app.register(corsPlugin);

// Register logging plugin
app.register(loggingPlugin);

// Register proxy plugin
app.register(proxyPlugin);

// Routes
app.get('/', async () => {
    return 'Hello World - Github Actions Deployment Test';
});

app.post('/local-proxy*', async () => {
    return 'Hello World - From the local proxy';
});

export default app;

