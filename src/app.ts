// Main module file
import fastify from 'fastify';
import {TypeBoxTypeProvider} from '@fastify/type-provider-typebox';
import loggingPlugin from './plugins/logging';
import corsPlugin from './plugins/cors';
import proxyPlugin from './plugins/proxy';
import {getLoggerConfig} from './utils/logger';
import {errorHandler} from './utils/error-handler';
import v1Routes from './routes/v1';
import replyFrom from '@fastify/reply-from';

const app = fastify({
    logger: getLoggerConfig(),
    disableRequestLogging: true,
    trustProxy: process.env.TRUST_PROXY !== 'false'
}).withTypeProvider<TypeBoxTypeProvider>();

// Register global validation error handler
app.setErrorHandler(errorHandler());

// Register reply-from plugin
app.register(replyFrom);

// Register CORS plugin
app.register(corsPlugin);

// Register logging plugin
app.register(loggingPlugin);

// Register proxy plugin
app.register(proxyPlugin);

// Register v1 routes
app.register(v1Routes, {prefix: '/api/v1'});

// Routes
app.get('/', async () => {
    return 'Hello Ghost Traffic Analytics';
});

export default app;
