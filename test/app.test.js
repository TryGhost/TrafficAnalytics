const request = require('supertest');
const assert = require('node:assert/strict');
const createMockUpstream = require('./utils/mock-upstream');
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
        targetUrl = `http://${targetServer.server.address().address}:${targetServer.server.address().port}`;

        // Set the PROXY_TARGET environment variable before requiring the app
        process.env.PROXY_TARGET = targetUrl;
        process.env.LOG_LEVEL = 'silent';
        app = require('../src/app');
        app.ready().then(function () {
            proxyServer = app.server;
        });
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

        it('should accept requests with both parameters', async function () {
            await request(proxyServer)
                .post('/tb/web_analytics?token=abc123&name=test')
                .expect(function (res) {
                    // This should be proxied, so we can't assume a specific status code
                    // Just verify it's not 400 (bad request)
                    if (res.status === 400) {
                        throw new Error('Request was rejected when it should have been accepted');
                    }
                });
        });

        it('should proxy requests to the target server', async function () {
            await request(proxyServer)
                .post('/tb/web_analytics')
                .query({token: 'abc123', name: 'test'})
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
    });
});
