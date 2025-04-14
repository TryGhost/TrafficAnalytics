// Main module file
require('dotenv').config();
const {filterQueryParams} = require('./utils/query-params');

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
    request.log.info(`${request.method} ${request.url}`);
    done();
});

// Register HTTP proxy for /tb/web_analytics
fastify.register(require('@fastify/http-proxy'), {
    upstream: process.env.PROXY_TARGET || 'http://localhost:3000/local-proxy',
    prefix: '/tb/web_analytics',
    rewritePrefix: '', // we'll hardcode this in PROXY_TARGET
    httpMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    preHandler: (request, reply, done) => {
        // Extract parameters from query string
        const searchParams = new URLSearchParams(request.url.split('?')[1] || '');
        const token = searchParams.get('token');
        const name = searchParams.get('name');
        
        // Verify both token and name are present and not empty
        if (!token || token.trim() === '' || !name || name.trim() === '') {
            reply.code(400).send({
                error: 'Bad Request',
                message: 'Both token and name parameters are required'
            });
            return;
        }
        
        done();
    },
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
