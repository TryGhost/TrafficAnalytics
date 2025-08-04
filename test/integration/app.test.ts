import {describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi} from 'vitest';
import request, {Response} from 'supertest';
import createMockUpstream from '../utils/mock-upstream';
import {FastifyInstance} from 'fastify';
import {Server} from 'http';
import assert from 'node:assert/strict';

// Mock the user signature service before importing the app
vi.mock('../../src/services/user-signature', () => ({
    userSignatureService: {
        generateUserSignature: vi.fn().mockResolvedValue('a1b2c3d4e5f67890123456789012345678901234567890123456789012345678')
    }
}));

// Import the mocked service
import {userSignatureService} from '../../src/services/user-signature';

const eventPayload = {
    timestamp: '2025-04-14T22:16:06.095Z',
    action: 'page_hit',
    version: '1',
    session_id: '9017be4c-3065-484b-b117-9719ad1e3977',
    payload: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        locale: 'en-US',
        location: 'US',
        referrer: null,
        pathname: '/',
        href: 'https://www.chrisraible.com/',
        site_uuid: '940b73e9-4952-4752-b23d-9486f999c47e',
        post_uuid: 'undefined',
        post_type: 'null',
        member_uuid: 'undefined',
        member_status: 'free'
    }
};

// Renamed to avoid unused variable warning
type TargetRequest = {
    method: string;
    url: string;
    query: Record<string, string>;
    headers: Record<string, string>;
    body: {
        session_id: string;
        payload: {
            event_id?: string;
            browser: string;
            device: string;
            os: string;
            meta?: {
                [key: string]: unknown;
            };
        };
    };
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

    beforeEach(async () => {
        // Clear the targetRequests array in place
        // This is necessary because the target server is a mock and the requests are recorded in the same array
        // Using targetRequests = [] would create a new array, and the mock upstream would not record any requests
        targetRequests.length = 0;

        vi.stubEnv('PUBSUB_TOPIC_PAGE_HITS_RAW', undefined);
        vi.clearAllMocks();
    });

    afterEach(async () => {
        // Note: Global setup handles topic cleanup
    });

    describe('/', function () {
        it('should return Hello message on the root route', async function () {
            await request(proxyServer)
                .get('/')
                .expect(200)
                .expect('Hello Ghost Traffic Analytics');
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

    /* eslint-disable ghost/mocha/no-setup-in-describe */
    describe.each([
        '/tb/web_analytics', '/api/v1/page_hit'
    ])(`%s`, (path) => {
        it('should proxy requests to the target server', async function () {
            vi.stubEnv('TINYBIRD_TRACKER_TOKEN', undefined);
            await request(proxyServer)
                .post(path)
                .query({token: 'abc123', name: 'analytics_events_test'})
                .set('Content-Type', 'application/json')
                .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                .set('User-Agent', 'Mozilla/5.0 Test Browser')
                .send(eventPayload)
                .expect(202);

            expect(targetRequests.length).toBe(1);
            expect(targetRequests[0].method).toBe('POST');
            expect(targetRequests[0].url).toBe('/?token=abc123&name=analytics_events_test');
            expect(targetRequests[0].query.token).toBe('abc123');
            expect(targetRequests[0].query.name).toBe('analytics_events_test');
        });

        it('should not proxy requests to the target server if pub/sub topic is set', async function () {
            vi.stubEnv('PUBSUB_TOPIC_PAGE_HITS_RAW', 'test-topic');
            await request(proxyServer)
                .post(path)
                .query({name: 'analytics_events'})
                .set('Content-Type', 'application/json')
                .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                .set('User-Agent', 'Mozilla/5.0 Test Browser')
                .send(eventPayload);
            expect(targetRequests.length).toBe(0);
        });

        it('should handle proxy errors gracefully', async function () {
            await request(proxyServer)
                .post(path)
                .set('x-test-header-400', 'true')
                .expect(400);
        });

        describe('request validation', function () {
            it('should accept requests without token parameter', async function () {
                await request(proxyServer)
                    .post(path)
                    .query({name: 'analytics_events'})
                    .set('Content-Type', 'application/json')
                    .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                    .set('User-Agent', 'Mozilla/5.0 Test Browser')
                    .send(eventPayload)
                    .expect(202);
            });

            it('should reject requests without name parameter', async function () {
                await request(proxyServer)
                    .post(path)
                    .query({token: 'abc123'})
                    .set('Content-Type', 'application/json')
                    .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                    .set('User-Agent', 'Mozilla/5.0 Test Browser')
                    .send(eventPayload)
                    .expect(400)
                    .expect(function (res) {
                        assert.ok(res.body.message === 'querystring must have required property \'name\'');
                    });
            });

            it('should reject requests with invalid name parameter', async function () {
                await request(proxyServer)
                    .post(path)
                    .query({token: 'abc123', name: 'invalid_name'})
                    .set('Content-Type', 'application/json')
                    .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                    .set('User-Agent', 'Mozilla/5.0 Test Browser')
                    .send(eventPayload)
                    .expect(400)
                    .expect(function (res) {
                        assert.ok(res.body.message.includes('querystring/name'));
                    });
            });

            it('should reject requests with empty body', async function () {
                await request(proxyServer)
                    .post(path)
                    .query({token: 'abc123', name: 'test'})
                    .send({})
                    .expect(400)
                    .expect(function (res) {
                        assert.ok(res.body.message.includes('body'));
                    });
            });

            it('should reject requests without x-site-uuid header', async function () {
                await request(proxyServer)
                    .post(path)
                    .query({name: 'analytics_events'})
                    .set('Content-Type', 'application/json')
                    .set('User-Agent', 'Mozilla/5.0 Test Browser')
                    .send(eventPayload)
                    .expect(400)
                    .expect(function (res) {
                        assert.ok(res.body.message === 'headers must have required property \'x-site-uuid\'');
                    });
            });

            it('should reject requests without user-agent header', async function () {
                await request(proxyServer)
                    .post(path)
                    .query({name: 'analytics_events'})
                    .set('Content-Type', 'application/json')
                    .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                    .send(eventPayload)
                    .expect(400)
                    .expect(function (res) {
                        assert.ok(res.body.message === 'headers must have required property \'user-agent\'');
                    });
            });

            it('should reject requests with only whitespace in the user-agent header', async function () {
                await request(proxyServer)
                    .post(path)
                    .query({token: 'abc123', name: 'analytics_events'})
                    .set('Content-Type', 'application/json')
                    .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                    .set('User-Agent', ' ')
                    .send(eventPayload)
                    .expect(400)
                    .expect(function (res) {
                        assert.ok(res.body.message.includes('headers/user-agent must NOT have fewer than 1 characters'));
                    });
            });

            it('should return 404 for GET requests', async function () {
                await request(proxyServer)
                    .get(path)
                    .query({token: 'abc123', name: 'test'})
                    .expect(404);
            });

            it('should allow x-site-uuid header in CORS preflight requests', async function () {
                await request(proxyServer)
                    .options(path)
                    .set('Origin', 'https://main.ghost.org')
                    .set('Access-Control-Request-Method', 'POST')
                    .set('Access-Control-Request-Headers', 'x-site-uuid, content-type')
                    .expect(204)
                    .expect('Access-Control-Allow-Origin', '*')
                    .expect(function (res: Response) {
                        const allowedHeaders = res.headers['access-control-allow-headers'];
                        if (!allowedHeaders || !allowedHeaders.toLowerCase().includes('x-site-uuid')) {
                            throw new Error('x-site-uuid header should be allowed in CORS');
                        }
                    });
            });

            it('should not be too strict about the href value', async function () {
                const payloadWithWeirdHref = {
                    ...eventPayload,
                    href: 'https://www.thesgnl.com/2025/06/members-despatch-week-xxv-mmxxv/#dhvfg-yhkhel%23dhvfg-yhkhelasd/234/[]+'
                };

                await request(proxyServer)
                    .post(path)
                    .query({token: 'abc123', name: 'analytics_events_test'})
                    .set('Content-Type', 'application/json')
                    .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                    .set('User-Agent', 'Mozilla/5.0 Test Browser')
                    .send(payloadWithWeirdHref)
                    .expect(202);
            });
        });

        describe('event id transformation', function () {
            it('should generate an event id if it is not provided', async function () {
                await request(proxyServer)
                    .post(path)
                    .query({token: 'abc123', name: 'analytics_events_test'})
                    .set('Content-Type', 'application/json')
                    .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                    .set('User-Agent', 'Mozilla/5.0 Test Browser')
                    .send(eventPayload)
                    .expect(202);

                const targetRequest = targetRequests[0];
                expect(targetRequest.body.payload.event_id).toBeDefined();
                expect(targetRequest.body.payload.event_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/); // UUID format
            });

            it('should not generate a new event id if it is provided', async function () {
                const eventId = '12345678-1234-1234-1234-123456789012';
                const eventPayloadWithEventId = {
                    ...eventPayload,
                    payload: {
                        ...eventPayload.payload,
                        event_id: eventId
                    }
                };
                await request(proxyServer)
                    .post(path)
                    .query({token: 'abc123', name: 'analytics_events_test'})
                    .set('Content-Type', 'application/json')
                    .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                    .set('User-Agent', 'Mozilla/5.0 Test Browser')
                    .send(eventPayloadWithEventId)
                    .expect(202);

                const targetRequest = targetRequests[0];
                expect(targetRequest.body.payload.event_id).toBe(eventId);
            });
        });

        describe('user agent parsing', function () {
            it('should parse the OS from the user agent and pass it to the upstream server under the meta key', async function () {
                await request(proxyServer)
                    .post(path)
                    .query({token: 'abc123', name: 'analytics_events_test'})
                    .set('Content-Type', 'application/json')
                    .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                    .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36')
                    .send(eventPayload)
                    .expect(202);

                const targetRequest = targetRequests[0];
                expect(targetRequest.body.payload.os).toBe('macos');
            });

            it('should parse the browser from the user agent and pass it to the upstream server', async function () {
                await request(proxyServer)
                    .post(path)
                    .query({token: 'abc123', name: 'analytics_events_test'})
                    .set('Content-Type', 'application/json')
                    .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                    .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36')
                    .send(eventPayload)
                    .expect(202);

                const targetRequest = targetRequests[0];
                expect(targetRequest.body.payload.browser).toBe('chrome');
            });

            it('should parse the device from the user agent and pass it to the upstream server', async function () {
                await request(proxyServer)
                    .post(path)
                    .query({token: 'abc123', name: 'analytics_events_test'})
                    .set('Content-Type', 'application/json')
                    .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                    .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36')
                    .send(eventPayload)
                    .expect(202);

                const targetRequest = targetRequests[0];
                expect(targetRequest.body.payload.device).toBe('desktop');
            });
        });

        describe('bot filtering', function () {
            it('should filter bot traffic and return 202 without proxying to upstream', async function () {
                const initialRequestCount = targetRequests.length;
                
                // Test with Googlebot user agent
                await request(proxyServer)
                    .post(path)
                    .query({token: 'abc123', name: 'analytics_events_test'})
                    .set('Content-Type', 'application/json')
                    .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                    .set('User-Agent', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')
                    .send(eventPayload)
                    .expect(202);

                // Verify no request was sent to upstream
                expect(targetRequests.length).toBe(initialRequestCount);
            });

            it('should filter Googlebot with Android user agent', async function () {
                const initialRequestCount = targetRequests.length;
                
                // Test with Googlebot that has Android in user agent
                await request(proxyServer)
                    .post(path)
                    .query({token: 'abc123', name: 'analytics_events_test'})
                    .set('Content-Type', 'application/json')
                    .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                    .set('User-Agent', 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.7151.119 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')
                    .send(eventPayload)
                    .expect(202);

                // Verify no request was sent to upstream
                expect(targetRequests.length).toBe(initialRequestCount);
            });

            it('should not filter regular traffic', async function () {
                const initialRequestCount = targetRequests.length;
                
                // Test with regular browser user agent
                await request(proxyServer)
                    .post(path)
                    .query({token: 'abc123', name: 'analytics_events_test'})
                    .set('Content-Type', 'application/json')
                    .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                    .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')
                    .send(eventPayload)
                    .expect(202);

                // Verify request was sent to upstream
                expect(targetRequests.length).toBe(initialRequestCount + 1);
                const targetRequest = targetRequests[targetRequests.length - 1];
                expect(targetRequest.body.payload.device).toBe('desktop');
            });
        });

        describe('user signature generation', function () {
            it('should generate user signature and pass it to the upstream server', async function () {
                await request(proxyServer)
                    .post(path)
                    .query({token: 'abc123', name: 'analytics_events_test'})
                    .set('Content-Type', 'application/json')
                    .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                    .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')
                    .send(eventPayload)
                    .expect(202);

                const targetRequest = targetRequests[0];
                expect(targetRequest.body.session_id).toBeDefined();
                expect(targetRequest.body.session_id).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex format
            });

            it('should use client IP from X-Forwarded-For header when present', async function () {
                const clientIp = '203.0.113.42';
                const proxyIp = '192.168.1.1';
                const userAgent = 'Mozilla/5.0 Test Browser';

                await request(proxyServer)
                    .post(path)
                    .query({token: 'abc123', name: 'analytics_events_test'})
                    .set('Content-Type', 'application/json')
                    .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                    .set('User-Agent', userAgent)
                    .set('X-Forwarded-For', `${clientIp}, ${proxyIp}`)
                    .send(eventPayload)
                    .expect(202);

                // Verify that the user signature service was called with the client IP, not the proxy IP
                expect(vi.mocked(userSignatureService.generateUserSignature)).toHaveBeenCalledWith(
                    eventPayload.payload.site_uuid,
                    clientIp, // Should use the client IP from X-Forwarded-For
                    userAgent
                );
            });

            it('should handle multiple proxies in X-Forwarded-For header', async function () {
                const clientIp = '203.0.113.42';
                const proxy1 = '192.168.1.1';
                const proxy2 = '10.0.0.1';
                const userAgent = 'Mozilla/5.0 Test Browser';

                await request(proxyServer)
                    .post(path)
                    .query({token: 'abc123', name: 'analytics_events_test'})
                    .set('Content-Type', 'application/json')
                    .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                    .set('User-Agent', userAgent)
                    .set('X-Forwarded-For', `${clientIp}, ${proxy1}, ${proxy2}`)
                    .send(eventPayload)
                    .expect(202);

                // Verify that the user signature service was called with the first IP (client IP)
                expect(vi.mocked(userSignatureService.generateUserSignature)).toHaveBeenCalledWith(
                    eventPayload.payload.site_uuid,
                    clientIp, // Should use the first IP from X-Forwarded-For (the client IP)
                    userAgent
                );
            });

            it('should handle single IP in X-Forwarded-For header', async function () {
                const clientIp = '203.0.113.42';
                const userAgent = 'Mozilla/5.0 Test Browser';

                await request(proxyServer)
                    .post(path)
                    .query({token: 'abc123', name: 'analytics_events_test'})
                    .set('Content-Type', 'application/json')
                    .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                    .set('User-Agent', userAgent)
                    .set('X-Forwarded-For', clientIp)
                    .send(eventPayload)
                    .expect(202);

                // Verify that the user signature service was called with the client IP from X-Forwarded-For
                expect(vi.mocked(userSignatureService.generateUserSignature)).toHaveBeenCalledWith(
                    eventPayload.payload.site_uuid,
                    clientIp, // Should use the client IP from X-Forwarded-For
                    userAgent
                );
            });

            it('should use connection IP when no proxy headers are present', async function () {
                const userAgent = 'Mozilla/5.0 Direct Connection';

                await request(proxyServer)
                    .post(path)
                    .query({token: 'abc123', name: 'analytics_events_test'})
                    .set('Content-Type', 'application/json')
                    .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                    .set('User-Agent', userAgent)
                    .send(eventPayload)
                    .expect(202);

                // Verify that the user signature service was called with some IP
                // (we can't predict the exact IP for direct connections in test environment)
                expect(vi.mocked(userSignatureService.generateUserSignature)).toHaveBeenCalledWith(
                    eventPayload.payload.site_uuid,
                    expect.any(String), // Should use the connection IP
                    userAgent
                );

                // Verify the IP is not empty
                const callArgs = vi.mocked(userSignatureService.generateUserSignature).mock.calls[0];
                expect(callArgs[1]).toBeTruthy();
            });
        });

        describe('token handling with TINYBIRD_TRACKER_TOKEN', function () {
            it('should strip token query parameter and add authorization header when TINYBIRD_TRACKER_TOKEN is set', async () => {
                vi.stubEnv('TINYBIRD_TRACKER_TOKEN', 'tinybird-secret-token');

                await request(proxyServer)
                    .post(path)
                    .query({token: 'test-token', name: 'analytics_events_test'})
                    .set('Content-Type', 'application/json')
                    .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                    .set('User-Agent', 'Mozilla/5.0 Test Browser')
                    .send(eventPayload)
                    .expect(202);

                expect(targetRequests.length).toBe(1);
                const targetRequest = targetRequests[0];

                // Verify token query parameter was stripped
                expect(targetRequest.url).not.toContain('token=');
                expect(targetRequest.url).not.toContain('test-token');
                expect(targetRequest.query.token).toBeUndefined();

                // Verify authorization header was added
                expect(targetRequest.headers.authorization).toBe('Bearer tinybird-secret-token');
            });

            it('should keep token query parameter and not add authorization header when TINYBIRD_TRACKER_TOKEN is not set', async () => {
                vi.stubEnv('TINYBIRD_TRACKER_TOKEN', undefined);

                await request(proxyServer)
                    .post(path)
                    .query({token: 'test-token', name: 'analytics_events_test'})
                    .set('Content-Type', 'application/json')
                    .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                    .set('User-Agent', 'Mozilla/5.0 Test Browser')
                    .send(eventPayload)
                    .expect(202);

                expect(targetRequests.length).toBe(1);
                const targetRequest = targetRequests[0];

                // Verify token query parameter was preserved
                expect(targetRequest.url).toContain('token=test-token');
                expect(targetRequest.query.token).toBe('test-token');

                // Verify no authorization header was added
                expect(targetRequest.headers.authorization).toBeUndefined();
            });
        });
    });
});
