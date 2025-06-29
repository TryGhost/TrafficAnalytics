// Main module file
import fastify from 'fastify';
import {TypeBoxTypeProvider} from '@fastify/type-provider-typebox';
import loggingPlugin from './plugins/logging';
import corsPlugin from './plugins/cors';
import proxyPlugin from './plugins/proxy';
import {getLoggerConfig} from './utils/logger';
import {createValidationErrorHandler} from './utils/validation-error-handler';

const app = fastify({
    logger: getLoggerConfig(),
    disableRequestLogging: true,
    trustProxy: process.env.TRUST_PROXY !== 'false'
}).withTypeProvider<TypeBoxTypeProvider>();

// Register global validation error handler
app.setErrorHandler(createValidationErrorHandler());

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

export default app;

