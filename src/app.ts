// Main module file
import dotenv from 'dotenv';
dotenv.config();

import fastify, {FastifyReply} from 'fastify';
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
        }
    };
}

const app = fastify({
    logger: getLoggerConfig(),
    disableRequestLogging: true // we'll use our own logger
});

// Register CORS plugin
app.register(fastifyCors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
});

app.addHook('onRequest', (request, _reply, done) => {
    if (process.env.NODE_ENV === 'production') {
        request.log.info({
            req: request,
            type: 'request'
        }, 'incoming request');
    } else {
        request.log.info(`${request.method} ${request.url} - incoming request ${request.id}`);
    }
    done();
});

app.addHook('onResponse', (request, reply: FastifyReply, done) => {
    const responseTime = Math.round(reply.elapsedTime);
    if (process.env.NODE_ENV === 'production') {
        request.log.info({
            req: request,
            res: reply,
            responseTime,
            type: 'response'
        }, 'request completed');
    } else {
        request.log.info(`${request.method} ${request.url} - ${reply.statusCode} - ${responseTime}ms - request completed ${request.id}`);
    }
    done();
});

app.register(fastifyHttpProxy, getProxyConfig('/tb/web_analytics'));
app.register(fastifyHttpProxy, getProxyConfig('/.ghost/analytics/tb/web_analytics'));

// Routes
app.get('/', async () => {
    return 'Hello World - Github Actions Deployment Test';
});

app.post('/local-proxy*', async () => {
    return 'Hello World - From the local proxy';
});

export default app;

