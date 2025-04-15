// Main module file
require('dotenv').config();
const {filterQueryParams} = require('./utils/query-params');
const {processRequest, validateRequest} = require('./services/proxy');

const fastify = require('fastify')({
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
            req: function (req) {
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
fastify.register(require('@fastify/cors'), {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
});

// Request logging hook
fastify.addHook('onRequest', (request, reply, done) => {
    if (process.env.NODE_ENV !== 'testing') {
        request.log.info(`${request.method} ${request.url}`);
    }
    done();
});

// Register HTTP proxy for /tb/web_analytics
fastify.register(require('@fastify/http-proxy'), {
    upstream: process.env.PROXY_TARGET || 'http://localhost:3000/local-proxy',
    prefix: '/tb/web_analytics',
    rewritePrefix: '', // we'll hardcode this in PROXY_TARGET
    httpMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    preValidation: validateRequest,
    preHandler: processRequest,
    rewriteRequest: (req) => {
        // Filter query parameters to only include token and name
        req.url = filterQueryParams(req.url);
        return req;
    },
    replyOptions: {
        onError: (reply, err) => {
            reply.log.error(err);
            reply.status(502).send({error: 'Proxy error'});
        }
    }
});

// Routes
fastify.get('/', async () => {
    return 'Hello World - Github Actions Deployment Test';
});

fastify.post('/local-proxy*', async () => {
    return 'Hello World - From the local proxy';
});

module.exports = fastify;
