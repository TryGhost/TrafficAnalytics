import {describe, it, expect, beforeEach, beforeAll, afterAll} from 'vitest';
import request from 'supertest';
import createMockUpstream from '../utils/mock-upstream';
import {FastifyInstance} from 'fastify';
import {Server} from 'http';

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

// Renamed to avoid unused variable warning
type TargetRequest = {
    method: string;
    url: string;
    query: Record<string, string>;
    headers: Record<string, string>;
    body: Record<string, unknown>;
};

// This approach uses the inline server provided by Fastify for testing
describe('Fastify App', () => {
    // Create a new instance of the app for testing
    let targetServer: FastifyInstance;
    let proxyServer: Server;
    const targetRequests: TargetRequest[] = [];

    let targetUrl: string;
    let app: FastifyInstance;

    beforeAll(async () => {
        targetServer = createMockUpstream(targetRequests);
        await targetServer.listen({port: 0});
        const address = targetServer.server.address();
        if (!address || typeof address === 'string') {
            throw new Error('Invalid server address');
        }
        targetUrl = `http://127.0.0.1:${address.port}`;

        // Set the PROXY_TARGET environment variable before requiring the app
        process.env.PROXY_TARGET = targetUrl;
        process.env.LOG_LEVEL = 'silent';

        // Import directly from the source
        const appModule = await import('../../src/app');
        app = appModule.default;
        await app.ready();
        proxyServer = app.server;
    });

    afterAll(async () => {
        const promises: Promise<void>[] = [];
        if (app) {
            promises.push(app.close());
        }

        if (targetServer) {
            promises.push(targetServer.close());
        }

        await Promise.all(promises);
    });

    beforeEach(() => {
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

            expect(targetRequests.length).toBe(1);
            expect(targetRequests[0].method).toBe('POST');
            expect(targetRequests[0].url).toBe('/?token=abc123&name=test');
            expect(targetRequests[0].query.token).toBe('abc123');
            expect(targetRequests[0].query.name).toBe('test');
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
            expect(targetRequest.body.payload.os).toBe('macos');
        });

        it('should parse the browser from the user agent and pass it to the upstream server', async function () {
            await request(proxyServer)
                .post('/tb/web_analytics')
                .query({token: 'abc123', name: 'test'})
                .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36')
                .send(eventPayload)
                .expect(202);

            const targetRequest = targetRequests[0];
            expect(targetRequest.body.payload.browser).toBe('chrome');
        });

        it('should parse the device from the user agent and pass it to the upstream server', async function () {
            await request(proxyServer)
                .post('/tb/web_analytics')
                .query({token: 'abc123', name: 'test'})
                .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36')
                .send(eventPayload)
                .expect(202);

            const targetRequest = targetRequests[0];
            expect(targetRequest.body.payload.device).toBe('desktop');
        });

        it('should generate user signature and pass it to the upstream server', async function () {
            await request(proxyServer)
                .post('/tb/web_analytics')
                .query({token: 'abc123', name: 'test'})
                .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')
                .send(eventPayload)
                .expect(202);

            const targetRequest = targetRequests[0];
            expect(targetRequest.body.payload.meta).toBeDefined();
            expect(targetRequest.body.payload.meta.userSignature).toBeDefined();
            expect(targetRequest.body.payload.meta.userSignature).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex format
        });
    });

    describe('/.ghost/analytics/tb/web_analytics', function () {
        it('should reject requests without token parameter', async function () {
            await request(proxyServer)
                .post('/.ghost/analytics/tb/web_analytics?name=test')
                .expect(400)
                .expect(function (res) {
                    if (!res.body.error || !res.body.message) {
                        throw new Error('Expected error response with message');
                    }
                });
        });

        it('should reject requests without name parameter', async function () {
            await request(proxyServer)
                .post('/.ghost/analytics/tb/web_analytics?token=abc123')
                .expect(400)
                .expect(function (res) {
                    if (!res.body.error || !res.body.message) {
                        throw new Error('Expected error response with message');
                    }
                });
        });

        it('should reject requests with empty parameters', async function () {
            await request(proxyServer)
                .post('/.ghost/analytics/tb/web_analytics?token=&name=test')
                .expect(400)
                .expect(function (res) {
                    if (!res.body.error || !res.body.message) {
                        throw new Error('Expected error response with message');
                    }
                });
        });

        it('should reject requests with empty body', async function () {
            await request(proxyServer)
                .post('/.ghost/analytics/tb/web_analytics?token=abc123&name=test')
                .send({})
                .expect(400);
        });

        it('should proxy requests to the target server', async function () {
            await request(proxyServer)
                .post('/.ghost/analytics/tb/web_analytics')
                .query({token: 'abc123', name: 'test'})
                .send(eventPayload)
                .expect(202);

            expect(targetRequests.length).toBe(1);
            expect(targetRequests[0].method).toBe('POST');
            expect(targetRequests[0].url).toBe('/?token=abc123&name=test');
            expect(targetRequests[0].query.token).toBe('abc123');
            expect(targetRequests[0].query.name).toBe('test');
        });

        it('should handle proxy errors gracefully', async function () {
            await request(proxyServer)
                .post('/.ghost/analytics/tb/web_analytics')
                .set('x-test-header-400', 'true')
                .expect(400);
        });

        it('should parse the OS from the user agent and pass it to the upstream server under the meta key', async function () {
            await request(proxyServer)
                .post('/.ghost/analytics/tb/web_analytics')
                .query({token: 'abc123', name: 'test'})
                .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36')
                .send(eventPayload)
                .expect(202);

            const targetRequest = targetRequests[0];
            expect(targetRequest.body.payload.os).toBe('macos');
        });

        it('should parse the browser from the user agent and pass it to the upstream server', async function () {
            await request(proxyServer)
                .post('/.ghost/analytics/tb/web_analytics')
                .query({token: 'abc123', name: 'test'})
                .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36')
                .send(eventPayload)
                .expect(202);

            const targetRequest = targetRequests[0];
            expect(targetRequest.body.payload.browser).toBe('chrome');
        });

        it('should parse the device from the user agent and pass it to the upstream server', async function () {
            await request(proxyServer)
                .post('/.ghost/analytics/tb/web_analytics')
                .query({token: 'abc123', name: 'test'})
                .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36')
                .send(eventPayload)
                .expect(202);

            const targetRequest = targetRequests[0];
            expect(targetRequest.body.payload.device).toBe('desktop');
        });
    });
});
