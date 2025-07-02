import {describe, expect, it, beforeEach} from 'vitest';
import createApp from '../../../src/app';
import {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import fixtures from '../../utils/fixtures';
import {expectValidationErrorWithMessage, expectUnsupportedMediaTypeErrorWithMessage} from '../../utils/assertions';

function handlerStub(_request: FastifyRequest, reply: FastifyReply, done: () => void) {
    reply.code(202);
    done();
}

describe('Unversioned API Endpoint', function () {
    let app: FastifyInstance;

    describe('POST /tb/web_analytics', () => {
        beforeEach(async function () {
            app = createApp();
            app.addHook('preHandler', handlerStub);
        });

        describe('Request validation', function () {
            it('should accept a default valid request from the tracking script', async function () {
                const response = await app.inject({
                    method: 'POST',
                    url: '/tb/web_analytics',
                    query: fixtures.defaultValidRequestQuery,
                    headers: fixtures.defaultValidRequestHeaders,
                    body: fixtures.defaultValidRequestBody
                });
                expect(response.statusCode).toBe(202);
            });

            describe('requests with missing or invalid required headers', function () {
                it('should reject a request with a missing site uuid header', async function () {
                    const response = await app.inject({
                        method: 'POST',
                        url: '/tb/web_analytics',
                        query: fixtures.defaultValidRequestQuery,
                        headers: fixtures.headersWithoutSiteUuid,
                        body: fixtures.defaultValidRequestBody
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
                        query: fixtures.defaultValidRequestQuery,
                        headers: fixtures.headersWithoutUserAgent,
                        body: fixtures.defaultValidRequestBody
                    });
                    expectValidationErrorWithMessage(response, 'headers must have required property \'user-agent\'');
                });

                it('should reject a request with a content type other than application/json', async function () {
                    const response = await app.inject({
                        method: 'POST',
                        url: '/tb/web_analytics',
                        query: fixtures.defaultValidRequestQuery,
                        headers: fixtures.headersWithInvalidContentType,
                        body: fixtures.defaultValidRequestBody
                    });
                    expectUnsupportedMediaTypeErrorWithMessage(response, 'Unsupported Media Type: application/xml');
                });
            });
        });    
    });
});