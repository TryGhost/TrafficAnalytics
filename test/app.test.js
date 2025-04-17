const request = require('supertest');
const assert = require('node:assert/strict');
const createMockUpstream = require('./testUtils/mock-upstream');

const eventPayload = {
    timestamp: '2025-04-14T22:16:06.095Z',
    action: 'page_hit',
    version: '1',
    session_id: '9017be4c-3065-484b-b117-9719ad1e3977',
    payload: {
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        locale: 'en-US',
        location: 'US',
        referrer: null,
        pathname: '/',
        href: 'https://www.chrisraible.com/',
        site_uuid: '940b73e9-4952-4752-b23d-9486f999c47e',
        post_uuid: 'undefined',
        member_uuid: 'undefined',
        member_status: 'undefined'
    }
};

// This approach uses the inline server provided by Fastify for testing
describe('Fastify App', function () {
    // Create a new instance of the app for testing
    let targetServer;
    let proxyServer;
    let targetRequests = [];

    let targetUrl;
    let app;

    before(async function () {
        targetServer = createMockUpstream(targetRequests);
        await targetServer.listen({port: 0});
        targetUrl = `http://127.0.0.1:${targetServer.server.address().port}`;

        // Set the PROXY_TARGET environment variable before requiring the app
        process.env.PROXY_TARGET = targetUrl;
        process.env.LOG_LEVEL = 'silent';
        
        // Import the compiled app from the dist directory
        const appModule = require('../dist/src/app');
        app = appModule.default;
        await app.ready();
        proxyServer = app.server;
    });

    after(function () {
        const promises = [];
        if (app) {
            promises.push(app.close());
        }

        if (targetServer) {
            promises.push(targetServer.close());
        }

        return Promise.all(promises);
    });

    beforeEach(function () {
        // Clear the targetRequests array in place
        // This is necessary because the target server is a mock and the requests are recorded in the same array
        // Using targetRequests = [] would create a new array, and the mock upstream would not record any requests
        targetRequests.length = 0;
    });

    describe('/', function () {
        it('should return Hello World on the root route', async function () {
            await request(proxyServer)
                .get('/')
                .expect(200)
                .expect('Hello World - Github Actions Deployment Test');
        });

        it('should respond 404 to other methods on root route', async function () {
            await request(proxyServer)
                .post('/')
                .expect(404);
        });
    });

    describe('/local-proxy', function () {
        it('should handle requests to local-proxy path', async function () {
            await request(proxyServer)
                .post('/local-proxy')
                .expect(200)
                .expect('Hello World - From the local proxy');
        });

        it('should respond 404 to GET on local-proxy path', async function () {
            await request(proxyServer)
                .get('/local-proxy')
                .expect(404);
        });
    });

    describe('/tb/web_analytics', function () {
        it('should reject requests without token parameter', async function () {
            await request(proxyServer)
                .post('/tb/web_analytics?name=test')
                .expect(400)
                .expect(function (res) {
                    if (!res.body.error || !res.body.message) {
                        throw new Error('Expected error response with message');
                    }
                });
        });

        it('should reject requests without name parameter', async function () {
            await request(proxyServer)
                .post('/tb/web_analytics?token=abc123')
                .expect(400)
                .expect(function (res) {
                    if (!res.body.error || !res.body.message) {
                        throw new Error('Expected error response with message');
                    }
                });
        });

        it('should reject requests with empty parameters', async function () {
            await request(proxyServer)
                .post('/tb/web_analytics?token=&name=test')
                .expect(400)
                .expect(function (res) {
                    if (!res.body.error || !res.body.message) {
                        throw new Error('Expected error response with message');
                    }
                });
        });

        it('should reject requests with empty body', async function () {
            await request(proxyServer)
                .post('/tb/web_analytics?token=abc123&name=test')
                .send({})
                .expect(400);
        });

        it('should proxy requests to the target server', async function () {
            await request(proxyServer)
                .post('/tb/web_analytics')
                .query({token: 'abc123', name: 'test'})
                .send(eventPayload)
                .expect(202);

            assert.equal(targetRequests.length, 1);
            assert.equal(targetRequests[0].method, 'POST');
            assert.equal(targetRequests[0].url, '/?token=abc123&name=test');
            assert.equal(targetRequests[0].query.token, 'abc123');
            assert.equal(targetRequests[0].query.name, 'test');
        });

        it('should handle proxy errors gracefully', async function () {
            await request(proxyServer)
                .post('/tb/web_analytics')
                .set('x-test-header-400', 'true')
                .expect(400);
        });

        it('should parse the OS from the user agent and pass it to the upstream server under the meta key', async function () {
            await request(proxyServer)
                .post('/tb/web_analytics')
                .query({token: 'abc123', name: 'test'})
                .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36')
                .send(eventPayload)
                .expect(202);

            const targetRequest = targetRequests[0];
            assert.deepEqual(targetRequest.body.payload.meta.os, 'macos');
        });

        it('should parse the browser from the user agent and pass it to the upstream server', async function () {
            await request(proxyServer)
                .post('/tb/web_analytics')
                .query({token: 'abc123', name: 'test'})
                .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36')
                .send(eventPayload)
                .expect(202);

            const targetRequest = targetRequests[0];
            assert.deepEqual(targetRequest.body.payload.meta.browser, 'chrome');
        });

        it('should parse the device from the user agent and pass it to the upstream server', async function () {
            await request(proxyServer)
                .post('/tb/web_analytics')
                .query({token: 'abc123', name: 'test'})
                .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36')
                .send(eventPayload)
                .expect(202);

            const targetRequest = targetRequests[0];
            assert.deepEqual(targetRequest.body.payload.meta.device, 'desktop');
        });
    });
});
