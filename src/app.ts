// Main module file
import dotenv from 'dotenv';
dotenv.config();

import {FastifyInstance, FastifyReply} from 'fastify';
import fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHttpProxy from '@fastify/http-proxy';
import {filterQueryParams} from './utils/query-params';
import { processRequest, validateRequest } from './services/proxy';

function getProxyConfig(prefix: string): any {
    return {
        upstream: process.env.PROXY_TARGET || 'http://localhost:3000/local-proxy',
        prefix: prefix,
        rewritePrefix: '', // we'll hardcode this in PROXY_TARGET
        httpMethods: ['GET', 'POST', 'PUT', 'DELETE'],
        preValidation: validateRequest as any,
        preHandler: processRequest as any,
        rewriteRequest: (req: any) => {
            // Filter query parameters to only include token and name
            req.url = filterQueryParams(req.url);
            return req;
        },
        replyOptions: {
            onError: (reply: FastifyReply, error: Error) => {
                reply.log.error(error);
                reply.status(502).send({error: 'Proxy error'});
            }
        }
    };
}

const app: FastifyInstance = fastify({
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
            req: function (req: any) {
                return {
                    method: req.method,
                    url: req.url
                };
            },
            res: function (res: any) {
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
app.addHook('onRequest', (request, reply, done) => {
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

