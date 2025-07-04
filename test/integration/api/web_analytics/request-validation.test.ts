import {describe, it, beforeEach} from 'vitest';
import {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import {expectResponse} from '../../../utils/assertions';
import defaultValidRequestQuery from '../../../utils/fixtures/defaultValidRequestQuery.json';
import defaultValidRequestHeaders from '../../../utils/fixtures/defaultValidRequestHeaders.json';
import defaultValidRequestBody from '../../../utils/fixtures/defaultValidRequestBody.json';
import headersWithInvalidContentType from '../../../utils/fixtures/headersWithInvalidContentType.json';
import headersWithoutUserAgent from '../../../utils/fixtures/headersWithoutUserAgent.json';
import headersWithoutSiteUuid from '../../../utils/fixtures/headersWithoutSiteUuid.json';
import {initializeApp} from '../../../../src/initializeApp';

const preHandlerStub = async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.code(202);
};

describe('POST /tb/web_analytics', () => {
    let app: FastifyInstance;

    describe('Request validation', function () {
        beforeEach(async function () {
            app = await initializeApp({isWorkerMode: false});
            app.addHook('preHandler', preHandlerStub);
        });

        it('should accept a default valid request from the tracking script', async function () {
            const response = await app.inject({
                method: 'POST',
                url: '/tb/web_analytics',
                query: defaultValidRequestQuery,
                headers: defaultValidRequestHeaders,
                body: defaultValidRequestBody
            });
            expectResponse({response, statusCode: 202});
        });

        describe('requests with missing or invalid required headers', function () {
            it('should reject a request with a missing site uuid header', async function () {
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
            });
    
            it('should reject a request with a missing user agent header', async function () {
                // fastify.inject() adds a default user-agent header, so we need to remove it before validation
                app.addHook('onRequest', async (request) => {
                    delete request.headers['user-agent'];
                });
                    
                const response = await app.inject({
                    method: 'POST',
                    url: '/tb/web_analytics',
                    query: defaultValidRequestQuery,
                    headers: headersWithoutUserAgent,
                    body: defaultValidRequestBody
                });
                expectResponse({
                    response, 
                    statusCode: 400, 
                    errorType: 'Bad Request',
                    message: 'headers must have required property \'user-agent\''
                });
            });

            it('should reject a request with a content type other than application/json', async function () {
                const response = await app.inject({
                    method: 'POST',
                    url: '/tb/web_analytics',
                    query: defaultValidRequestQuery,
                    headers: headersWithInvalidContentType,
                    body: defaultValidRequestBody
                });
                expectResponse({
                    response, 
                    statusCode: 415, 
                    errorType: 'Unsupported Media Type',
                    message: 'Unsupported Media Type: application/xml'
                });
            });
        });
    });
});