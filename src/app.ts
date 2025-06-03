// Main module file
import dotenv from 'dotenv';
dotenv.config();

import {FastifyInstance, FastifyRequest as FastifyRequestBase, RawServerDefault} from 'fastify';
import fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHttpProxy, {FastifyHttpProxyOptions} from '@fastify/http-proxy';
import {processRequest, validateRequest} from './services/proxy';

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
                reply.log.error(error);
                reply.status(502).send({error: 'Proxy error'});
            }
        }
    };
}

const app: FastifyInstance<RawServerDefault> = fastify({
    logger: {
        level: process.env.LOG_LEVEL || 'info',
        transport: {
            target: 'pino-pretty',
            options: {
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname,reqId,responseTime,req,res',
                messageFormat: '{msg} {url}'
            }
        },
        serializers: {
            req: function (req: FastifyRequestBase) {
                return {
                    method: req.method,
                    url: req.url
                };
            },
            res: function (res) {
                return {
                    statusCode: res.statusCode
                };
            }
        }
    }
});

// Register CORS plugin
app.register(fastifyCors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
});

// Request logging hook
app.addHook('onRequest', (request, _reply, done) => {
    if (process.env.NODE_ENV !== 'testing') {
        request.log.info(`${request.method} ${request.url}`);
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

