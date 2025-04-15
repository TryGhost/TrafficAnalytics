// Main module file
require('dotenv').config();
const {filterQueryParams} = require('./utils/query-params');
const uap = require('ua-parser-js');

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
    preValidation: (request, reply, done) => {
        // Validate the request before proxying it
        const token = request.query.token;
        const name = request.query.name;

        // Verify both token and name are present and not empty
        if (!token || token.trim() === '' || !name || name.trim() === '') {
            reply.code(400).send({
                error: 'Bad Request',
                message: 'Token and name query parameters are required'
            });
            return;
        }

        // Validate the request body
        if (!request.body || Object.keys(request.body).length === 0 || !request.body.payload) {
            reply.code(400).send({
                error: 'Bad Request',
                message: 'Request body is required'
            });
            return;
        }

        done();
    },
    preHandler: (request, reply, done) => {
        // Process & Modify the request body
        try {
            const ua = new uap(request.headers['user-agent']);
            const os = ua.getOS() || {name: 'unknown', version: 'unknown'};
            const browser = ua.getBrowser() || {name: 'unknown', version: 'unknown', major: 'unknown', type: 'unknown'};
            const device = ua.getDevice() || {type: 'unknown', vendor: 'unknown', model: 'unknown'};
            request.body.payload.meta = {};
            request.body.payload.meta.os = os;
            request.body.payload.meta.browser = browser;
            request.body.payload.meta.device = device;
        } catch (error) {
            request.log.error(error);
            // We should fail silently here, because we don't want to break the proxy for non-critical functionality
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
