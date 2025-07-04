import {describe, expect, it, beforeEach, beforeAll, vi} from 'vitest';
import {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import {expectResponse} from '../../../utils/assertions';
import {createPubSubSpy} from '../../../utils/pubsub-spy';
import defaultValidRequestQuery from '../../../utils/fixtures/defaultValidRequestQuery.json';
import defaultValidRequestHeaders from '../../../utils/fixtures/defaultValidRequestHeaders.json';
import defaultValidRequestBody from '../../../utils/fixtures/defaultValidRequestBody.json';
import headersWithoutSiteUuid from '../../../utils/fixtures/headersWithoutSiteUuid.json';
import {initializeApp} from '../../../../src/initializeApp';
import {EventPublisher} from '../../../../src/services/events/publisher';

const preHandlerStub = async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.code(202);
};

describe('POST /tb/web_analytics', () => {
    let app: FastifyInstance;

    describe('Batch Mode - Publishing to pub/sub', function () {
        let pubSubSpy: ReturnType<typeof createPubSubSpy>;
        const pageHitsRawTopic: string = 'page-hits-raw';

        beforeAll(async function () {
            vi.stubEnv('PUBSUB_TOPIC_PAGE_HITS_RAW', pageHitsRawTopic);
        });
        beforeEach(async function () {
            app = await initializeApp({isWorkerMode: false});
            app.addHook('preHandler', preHandlerStub);
            pubSubSpy = createPubSubSpy();
            EventPublisher.resetInstance(pubSubSpy.mockPubSub as any);
        });

        it('should transform the request body and publish to pub/sub', async function () {
            await app.inject({
                method: 'POST',
                url: '/tb/web_analytics',
                query: defaultValidRequestQuery,
                headers: defaultValidRequestHeaders,
                body: defaultValidRequestBody
            });
                
            pubSubSpy.expectPublishedMessageToTopic(pageHitsRawTopic).withMessageData({
                timestamp: expect.any(String),
                action: 'page_hit',
                version: '1',
                site_uuid: defaultValidRequestHeaders['x-site-uuid'],
                payload: {
                    event_id: defaultValidRequestBody.payload.event_id,
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
                query: defaultValidRequestQuery,
                headers: headersWithoutSiteUuid,
                body: defaultValidRequestBody
            });
            expectResponse({
                response, 
                statusCode: 400, 
                errorType: 'Bad Request',
                message: 'headers must have required property \'x-site-uuid\''
            });
            pubSubSpy.expectNoMessagesPublished();
        });
    });
});