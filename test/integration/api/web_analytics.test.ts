import {describe, expect, it, vi, beforeEach} from 'vitest';
import createApp from '../../../src/app';
import {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import fixtures from '../../utils/fixtures';
import {expectValidationErrorWithMessage, expectUnsupportedMediaTypeErrorWithMessage} from '../../utils/assertions';
import {createPubSubSpy} from '../../utils/pubsub-spy';
import {EventPublisher} from '../../../src/services/events/publisher';

function handlerStub(_request: FastifyRequest, reply: FastifyReply, done: () => void) {
    reply.code(202);
    done();
}

describe('Unversioned API Endpoint', function () {
    let app: FastifyInstance;

    describe('POST /tb/web_analytics', () => {
        describe('Request validation', function () {
            beforeEach(async function () {
                app = createApp();
                // Handler stub is only called if validation passes
                app.addHook('preHandler', handlerStub);
            });

            it('should accept a default valid request from the tracking script', async function () {
                const response = await app.inject({
                    method: 'POST',
                    url: '/tb/web_analytics',
                    query: fixtures.queryParams.defaultValidRequestQuery,
                    headers: fixtures.headers.defaultValidRequestHeaders,
                    body: fixtures.pageHits.defaultValidRequestBody
                });
                expect(response.statusCode).toBe(202);
            });

            describe('requests with missing or invalid required headers', function () {
                it('should reject a request with a missing site uuid header', async function () {
                    const response = await app.inject({
                        method: 'POST',
                        url: '/tb/web_analytics',
                        query: fixtures.queryParams.defaultValidRequestQuery,
                        headers: fixtures.headers.headersWithoutSiteUuid,
                        body: fixtures.pageHits.defaultValidRequestBody
                    });
                    expectValidationErrorWithMessage(response, 'headers must have required property \'x-site-uuid\'');
                });
    
                it('should reject a request with a missing user agent header', async function () {
                    // fastify.inject() adds a default user-agent header, so we need to remove it before validation
                    app.addHook('onRequest', async (request) => {
                        delete request.headers['user-agent'];
                    });
                    
                    const response = await app.inject({
                        method: 'POST',
                        url: '/tb/web_analytics',
                        query: fixtures.queryParams.defaultValidRequestQuery,
                        headers: fixtures.headers.headersWithoutUserAgent,
                        body: fixtures.pageHits.defaultValidRequestBody
                    });
                    expectValidationErrorWithMessage(response, 'headers must have required property \'user-agent\'');
                });

                it('should reject a request with a content type other than application/json', async function () {
                    const response = await app.inject({
                        method: 'POST',
                        url: '/tb/web_analytics',
                        query: fixtures.queryParams.defaultValidRequestQuery,
                        headers: fixtures.headers.headersWithInvalidContentType,
                        body: fixtures.pageHits.defaultValidRequestBody
                    });
                    expectUnsupportedMediaTypeErrorWithMessage(response, 'Unsupported Media Type: application/xml');
                });
            });
        });

        describe('Batch Mode - Publishing to pub/sub', function () {
            const gcpProjectId: string = 'test-project';
            const pageHitsRawTopic: string = 'page-hits-raw';
            let pubSubSpy: ReturnType<typeof createPubSubSpy>;

            beforeEach(async function () {
                vi.stubEnv('GOOGLE_CLOUD_PROJECT', gcpProjectId);
                vi.stubEnv('PUBSUB_TOPIC_PAGE_HITS_RAW', pageHitsRawTopic);
                
                // Create and inject PubSub spy
                pubSubSpy = createPubSubSpy();
                EventPublisher.resetInstance(pubSubSpy.mockPubSub as any);
                
                app = createApp();
            });

            it('should transform the request body and publish to pub/sub', async function () {
                await app.inject({
                    method: 'POST',
                    url: '/tb/web_analytics',
                    query: fixtures.queryParams.defaultValidRequestQuery,
                    headers: fixtures.headers.defaultValidRequestHeaders,
                    body: fixtures.pageHits.defaultValidRequestBody
                });
                
                pubSubSpy.expectPublishedMessageToTopic(pageHitsRawTopic).withMessageData({
                    timestamp: expect.any(String),
                    action: 'page_hit',
                    version: '1',
                    site_uuid: fixtures.headers.defaultValidRequestHeaders['x-site-uuid'],
                    payload: {
                        event_id: fixtures.pageHits.defaultValidRequestBody.payload.event_id,
                        href: 'https://www.example.com/',
                        pathname: '/',
                        member_uuid: 'undefined',
                        member_status: 'undefined',
                        post_uuid: 'undefined',
                        post_type: 'null',
                        parsedReferrer: {
                            medium: '',
                            source: '',
                            url: ''
                        },
                        locale: 'en-US',
                        location: 'US',
                        referrer: null
                    },
                    meta: {
                        ip: expect.any(String),
                        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
                    }
                });
            });

            it('should not publish a message if the request fails validation', async function () {
                const response = await app.inject({
                    method: 'POST',
                    url: '/tb/web_analytics',
                    query: fixtures.queryParams.defaultValidRequestQuery,
                    headers: fixtures.headers.headersWithoutSiteUuid,
                    body: fixtures.pageHits.defaultValidRequestBody
                });
                expectValidationErrorWithMessage(response, 'headers must have required property \'x-site-uuid\'');
                pubSubSpy.expectNoMessagesPublished();
            });
        });
    });
});