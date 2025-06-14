import {describe, it, expect, beforeEach, beforeAll, afterAll, vi} from 'vitest';
import request, {Response} from 'supertest';
import createMockUpstream from '../utils/mock-upstream';
import {FastifyInstance} from 'fastify';
import {Server} from 'http';
import {PubSub} from '@google-cloud/pubsub';

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
    body: {
        session_id: string;
        payload: {
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

    beforeEach(() => {
        // Clear the targetRequests array in place
        // This is necessary because the target server is a mock and the requests are recorded in the same array
        // Using targetRequests = [] would create a new array, and the mock upstream would not record any requests
        targetRequests.length = 0;
        
        // Clear mock calls
        vi.clearAllMocks();
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
                .expect(function (res: Response) {
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
            expect(targetRequest.body.session_id).toBeDefined();
            expect(targetRequest.body.session_id).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex format
        });

        it('should use client IP from X-Forwarded-For header when present', async function () {
            const clientIp = '203.0.113.42';
            const proxyIp = '192.168.1.1';
            const userAgent = 'Mozilla/5.0 Test Browser';
            
            await request(proxyServer)
                .post('/tb/web_analytics')
                .query({token: 'abc123', name: 'test'})
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
                .post('/tb/web_analytics')
                .query({token: 'abc123', name: 'test'})
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
                .post('/tb/web_analytics')
                .query({token: 'abc123', name: 'test'})
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
                .post('/tb/web_analytics')
                .query({token: 'abc123', name: 'test'})
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

        it('should publish page hit events to Pub/Sub topic', async () => {
            const pubsub = new PubSub({
                projectId: process.env.GOOGLE_CLOUD_PROJECT || 'traffic-analytics-dev'
            });

            const topic = process.env.PUBSUB_TOPIC_PAGE_HITS_RAW || 'traffic-analytics-page-hits-raw';
            const subscriptionName = `test-page-hits-subscription-${Date.now()}`;
            const uniqueUserAgent = `Test-Pub-Sub-Browser/${Date.now()}`;
            
            // Create a subscription to capture messages
            const [subscription] = await pubsub.topic(topic).createSubscription(subscriptionName);

            const receivedMessages: any[] = [];
            const messageHandler = (message: any) => {
                const data = JSON.parse(message.data.toString());
                // Only capture messages from our specific test
                if (data.headers && data.headers['user-agent'] === uniqueUserAgent) {
                    receivedMessages.push(data);
                }
                message.ack();
            };

            subscription.on('message', messageHandler);

            // Make the request
            await request(proxyServer)
                .post('/tb/web_analytics')
                .query({token: 'abc123', name: 'test'})
                .set('User-Agent', uniqueUserAgent)
                .send(eventPayload)
                .expect(202);

            // Wait for message to be received
            await new Promise<void>((resolve) => {
                setTimeout(() => resolve(), 2000);
            });

            // Verify we received the published message
            expect(receivedMessages.length).toBe(1);
            
            const publishedMessage = receivedMessages[0];
            expect(publishedMessage.method).toBe('POST');
            expect(publishedMessage.url).toContain('/tb/web_analytics');
            expect(publishedMessage.headers['user-agent']).toBe(uniqueUserAgent);
            expect(publishedMessage.ip).toBeDefined();
            expect(publishedMessage.timestamp).toBeDefined();
            
            // Verify the body contains the RAW payload (no processing)
            expect(publishedMessage.body).toEqual(eventPayload);
            
            // The session_id is part of the original raw payload, not added by processing
            expect(publishedMessage.body.session_id).toBe(eventPayload.session_id);
            
            // Verify NO processed fields were added to the payload
            expect(publishedMessage.body.payload.os).toBeUndefined();
            expect(publishedMessage.body.payload.browser).toBeUndefined();
            expect(publishedMessage.body.payload.device).toBeUndefined();

            // Clean up
            subscription.removeListener('message', messageHandler);
            await subscription.close();
            await subscription.delete().catch(() => {}); // Ignore errors during cleanup
        });

        it('should still proxy requests when Pub/Sub publishing fails', async () => {
            // Temporarily set an invalid topic to cause publishing to fail
            const originalTopic = process.env.PUBSUB_TOPIC_PAGE_HITS_RAW;
            process.env.PUBSUB_TOPIC_PAGE_HITS_RAW = 'invalid-topic-that-does-not-exist';

            try {
                await request(proxyServer)
                    .post('/tb/web_analytics')
                    .query({token: 'abc123', name: 'test'})
                    .set('User-Agent', 'Mozilla/5.0 Test Browser')
                    .send(eventPayload)
                    .expect(202);

                // Verify the request was still proxied to the target server
                expect(targetRequests.length).toBe(1);
                const targetRequest = targetRequests[0];
                // The proxy should still process the request and add fields
                expect(targetRequest.body.session_id).toBeDefined();
                expect(targetRequest.body.payload.os).toBeDefined();
                expect(targetRequest.body.payload.browser).toBeDefined();
                expect(targetRequest.body.payload.device).toBeDefined();
            } finally {
                // Restore original topic
                process.env.PUBSUB_TOPIC_PAGE_HITS_RAW = originalTopic;
            }
        });
    });
});
