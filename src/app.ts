// Main module file
import fastify from 'fastify';
import fastifyHttpProxy, {FastifyHttpProxyOptions} from '@fastify/http-proxy';
import {processRequest, validateRequest} from './services/proxy';
import loggingPlugin from './plugins/logging';
import corsPlugin from './plugins/cors';
import config from '@tryghost/config';
import {getLoggerConfig} from './utils/logger';

function getProxyConfig(prefix: string): FastifyHttpProxyOptions {
    return {
        upstream: config.get('PROXY_TARGET'),
        prefix: prefix,
        rewritePrefix: '', // we'll hardcode this in PROXY_TARGET
        httpMethods: ['GET', 'POST', 'PUT', 'DELETE'],
        preValidation: validateRequest as FastifyHttpProxyOptions['preValidation'],
        preHandler: processRequest as FastifyHttpProxyOptions['preHandler'],
        replyOptions: {
            onError: (reply, error) => {
                // Log proxy errors with proper structure for GCP
                const unwrappedError = error.error || error;
                reply.log.error({
                    err: {
                        message: unwrappedError.message,
                        stack: unwrappedError.stack,
                        name: unwrappedError.name
                    },
                    httpRequest: {
                        requestMethod: reply.request.method,
                        requestUrl: reply.request.url,
                        userAgent: reply.request.headers['user-agent'],
                        remoteIp: reply.request.ip,
                        referer: reply.request.headers.referer,
                        protocol: `${reply.request.protocol.toUpperCase()}/${reply.request.raw.httpVersion}`,
                        status: 502
                    },
                    upstream: process.env.PROXY_TARGET || 'http://localhost:3000/local-proxy',
                    type: 'proxy_error'
                }, 'Proxy error occurred');
                reply.status(502).send({error: 'Proxy error'});
            }
        },
        disableRequestLogging: config.get('LOG_PROXY_REQUESTS') === 'false'
    };
}

const app = fastify({
    logger: getLoggerConfig(),
    disableRequestLogging: true,
    trustProxy: config.get('TRUST_PROXY') !== 'false'
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

