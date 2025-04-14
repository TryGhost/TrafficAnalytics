// Main module file
require('dotenv').config();

const fastify = require('fastify')({
    logger: {
        transport: {
            target: 'pino-pretty'
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
    rewriteRequest: (req) => {
        // Get query parameters without creating a full URL object
        const searchParams = new URLSearchParams(req.url.split('?')[1] || '');
        
        // Extract only token and name
        const token = searchParams.get('token');
        const name = searchParams.get('name');
        
        // Create new query string with only these parameters
        const newSearchParams = new URLSearchParams();
        if (token) {
            newSearchParams.set('token', token);
        }
        if (name) {
            newSearchParams.set('name', name);
        }
        
        // Update the request URL (keep pathname, replace query)
        const path = req.url.split('?')[0];
        req.url = path + (newSearchParams.toString() ? `?${newSearchParams.toString()}` : '');
        
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
