// Main module file
import fastify from 'fastify';
import {TypeBoxTypeProvider} from '@fastify/type-provider-typebox';
import loggingPlugin from './plugins/logging';
import timestampPlugin from './plugins/timestamp';
import corsPlugin from './plugins/cors';
import proxyPlugin from './plugins/proxy';
import hmacValidationPlugin from './plugins/hmac-validation';
import {getLoggerConfig} from './utils/logger';
import {errorHandler} from './utils/error-handler';
import v1Routes from './routes/v1';
import replyFrom from '@fastify/reply-from';

const app = fastify({
    logger: getLoggerConfig(),
    disableRequestLogging: true,
    trustProxy: process.env.TRUST_PROXY !== 'false'
}).withTypeProvider<TypeBoxTypeProvider>();

// Global error handler
app.setErrorHandler(errorHandler());
app.register(replyFrom);
app.register(corsPlugin);
app.register(loggingPlugin);

// Register HMAC validation plugin (before all other business logic)
app.register(hmacValidationPlugin);

// Register proxy plugin
// Captures request arrival time
app.register(timestampPlugin);

// Local proxy endpoint for development/testing
app.register(proxyPlugin);

// Register routes
app.register(v1Routes, {prefix: '/api/v1'});
app.get('/', async () => {
    return 'Hello Ghost Traffic Analytics';
});

export default app;
