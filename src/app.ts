// Main module file
import dotenv from 'dotenv';
dotenv.config();

import fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHttpProxy, {FastifyHttpProxyOptions} from '@fastify/http-proxy';
import {processRequest, validateRequest} from './services/proxy';
import {getLoggerConfig} from './utils/logger';

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
app.register(fastifyCors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
});

app.addHook('onRequest', (request, _reply, done) => {
    const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
    const traceHeader = request.headers['x-cloud-trace-context'] as string;
    if (traceHeader && PROJECT_ID) {
        const traceId = traceHeader.split('/')[0];
        const traceContext = {
            'logging.googleapis.com/trace': `projects/${PROJECT_ID}/traces/${traceId}`
        };

        request.log = request.log.child(traceContext);
    }

    request.log.info({
        httpRequest: {
            requestMethod: request.method,
            requestUrl: request.url,
            userAgent: request.headers['user-agent'],
            remoteIp: request.ip,
            referer: request.headers.referer,
            protocol: `${request.protocol.toUpperCase()}/${request.raw.httpVersion}`,
            requestSize: String(request.raw.headers['content-length'] || 0)
        }
    }, 'incoming request');
    done();
});

app.addHook('onResponse', (request, reply, done) => {
    request.log.info({
        httpRequest: {
            requestMethod: request.method,
            requestUrl: request.url,
            userAgent: request.headers['user-agent'],
            remoteIp: request.ip,
            referer: request.headers.referer,
            protocol: `${request.protocol.toUpperCase()}/${request.raw.httpVersion}`,
            requestSize: String(request.raw.headers['content-length'] || 0),
            responseSize: String(reply.getHeader('content-length') || 0),
            status: reply.statusCode,
            latency: `${(reply.elapsedTime / 1000).toFixed(9)}s`
        }
    }, 'request completed');
    done();
});

app.register(fastifyHttpProxy, getProxyConfig('/tb/web_analytics'));

// Routes
app.get('/', async () => {
    return 'Hello World - Github Actions Deployment Test';
});

app.post('/local-proxy*', async () => {
    return 'Hello World - From the local proxy';
});

export default app;

