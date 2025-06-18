// Main module file
import dotenv from 'dotenv';
dotenv.config();

import fastify from 'fastify';
import fastifyHttpProxy, {FastifyHttpProxyOptions} from '@fastify/http-proxy';
import {processRequest, validateRequest} from './services/proxy';
import {getLoggerConfig} from './utils/logger';
import loggingPlugin from './plugins/logging';
import corsPlugin from './plugins/cors';

function getProxyConfig(prefix: string): FastifyHttpProxyOptions {
    return {
        upstream: process.env.PROXY_TARGET || 'http://localhost:3000/local-proxy',
        prefix: prefix,
        rewritePrefix: '', // we'll hardcode this in PROXY_TARGET
        httpMethods: ['GET', 'POST', 'PUT', 'DELETE'],
        preValidation: validateRequest as FastifyHttpProxyOptions['preValidation'],
        preHandler: processRequest as FastifyHttpProxyOptions['preHandler'],
        replyOptions: {
            onError: (reply, error) => {
                if (process.env.NODE_ENV === 'production') {
                    reply.log.error({
                        err: error,
                        req: reply.request,
                        upstream: process.env.PROXY_TARGET || 'http://localhost:3000/local-proxy',
                        type: 'proxy_error'
                    }, 'Proxy error occurred');
                } else {
                    reply.log.error(error);
                }
                reply.status(502).send({error: 'Proxy error'});
            }
        },
        disableRequestLogging: process.env.LOG_PROXY_REQUESTS === 'false'
    };
}

const app = fastify({
    logger: getLoggerConfig(),
    disableRequestLogging: true,
    trustProxy: process.env.TRUST_PROXY !== 'false' // defaults to true, can be disabled by setting to 'false'
});

// Register CORS plugin
app.register(corsPlugin);

// Register logging plugin
app.register(loggingPlugin);

app.register(fastifyHttpProxy, getProxyConfig('/tb/web_analytics'));

// Routes
app.get('/', async () => {
    return 'Hello World - Github Actions Deployment Test';
});

app.post('/local-proxy*', async () => {
    return 'Hello World - From the local proxy';
});

export default app;

