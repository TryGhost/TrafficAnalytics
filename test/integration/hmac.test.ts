import {describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi} from 'vitest';
import request from 'supertest';
import createMockUpstream from '../utils/mock-upstream';
import {FastifyInstance} from 'fastify';
import {Server} from 'http';
import {HmacValidationService, getHmacValidationService} from '../../src/services/hmac-validation';

// Mock the user signature service before importing the app
vi.mock('../../src/services/user-signature', () => ({
    userSignatureService: {
        generateUserSignature: vi.fn().mockResolvedValue('a1b2c3d4e5f67890123456789012345678901234567890123456789012345678')
    }
}));

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
describe('Fastify App (HMAC)', () => {
    // Create a new instance of the app for testing
    let targetServer: FastifyInstance;
    let proxyServer: Server;
    const targetRequests: TargetRequest[] = [];

    let targetUrl: string;
    let app: FastifyInstance;
    let hmacValidationService: HmacValidationService;

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
        process.env.HMAC_SECRET = 'TEST-HMAC-SECRET';

        hmacValidationService = getHmacValidationService();

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

        delete process.env.HMAC_SECRET;

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
        it('should return Hello message on the root route without auth being required', async function () {
            await request(proxyServer)
                .get('/')
                .expect(200)
                .expect('Hello Ghost Traffic Analytics');
        });
    });

    describe('/local-proxy', function () {
        it('should handle requests to local-proxy path without auth being required', async function () {
            await request(proxyServer)
                .post('/local-proxy')
                .expect(200)
                .expect('Hello World - From the local proxy');
        });
    });

    describe('POST /api/v1/page_hit', function () {
        const path = '/api/v1/page_hit';

        const signedRequest = (query: ConstructorParameters<typeof URLSearchParams>[0], addTimestamp = true) => {
            const queryString = new URLSearchParams(query);

            if (addTimestamp) {
                queryString.append('t', Date.now().toString());
            }

            const url = `${path}?${queryString.toString()}`;
            const hmacValue = hmacValidationService.generateHmac(url);
            const signedUrl = `${url}&hmac=${hmacValue}`;
            return request(proxyServer).post(signedUrl);
        };

        it('should accept signed requests', async function () {
            await signedRequest({name: 'analytics_events_test'})
                .set('Content-Type', 'application/json')
                .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                .set('User-Agent', 'Mozilla/5.0 Test Browser')
                .send(eventPayload)
                .expect(202);

            expect(targetRequests.length).toBe(1);
            expect(targetRequests[0].method).toBe('POST');
            expect(targetRequests[0].query.name).toBe('analytics_events_test');
            expect(targetRequests[0].query.hmac).toBeDefined();
        });

        it('should deny signed requests that are missing a timestamp', async function () {
            await signedRequest({name: 'analytics_events_test'}, false)
                .set('Content-Type', 'application/json')
                .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                .set('User-Agent', 'Mozilla/5.0 Test Browser')
                .send(eventPayload)
                .expect(401);
        });

        it('should deny signed requests that have a timestamp that is too old', async function () {
            await signedRequest({name: 'analytics_events_test', t: (Date.now() - (6 * 60 * 1000)).toString()}, false)
                .set('Content-Type', 'application/json')
                .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                .set('User-Agent', 'Mozilla/5.0 Test Browser')
                .send(eventPayload)
                .expect(401);
        });

        it('should deny signed requests that have a timestamp too far in the future', async function () {
            await signedRequest({name: 'analytics_events_test', t: (Date.now() + (10 * 1000)).toString()}, false)
                .set('Content-Type', 'application/json')
                .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                .set('User-Agent', 'Mozilla/5.0 Test Browser')
                .send(eventPayload)
                .expect(401);
        });

        it('should deny unsigned requests', async function () {
            await request(proxyServer)
                .post(path)
                .query({name: 'analytics_events_test'})
                .set('Content-Type', 'application/json')
                .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                .set('User-Agent', 'Mozilla/5.0 Test Browser')
                .send(eventPayload)
                .expect(401);
        });
    });
});
