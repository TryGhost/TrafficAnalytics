import {describe, expect, it, beforeEach} from 'vitest';
import createApp from '../../../src/app';
import {FastifyInstance} from 'fastify';
import defaultValidRequestHeaders from '../../utils/fixtures/defaultValidRequestHeaders.json';
import defaultValidRequestBody from '../../utils/fixtures/defaultValidRequestBody.json';
import defaultValidRequestQuery from '../../utils/fixtures/defaultValidRequestQuery.json';
import headersWithoutSiteUuid from '../../utils/fixtures/headersWithoutSiteUuid.json';

function handlerStub(_request, reply, done) {
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
                    query: defaultValidRequestQuery,
                    headers: defaultValidRequestHeaders,
                    body: defaultValidRequestBody
                });
                expect(response.statusCode).toBe(202);
            });

            it('should reject a request with a missing site uuid header', async function () {
                const response = await app.inject({
                    method: 'POST',
                    url: '/tb/web_analytics',
                    query: defaultValidRequestQuery,
                    headers: headersWithoutSiteUuid,
                    body: defaultValidRequestBody
                });
                const bodyJson = JSON.parse(response.body);
                expect(response.statusCode).toBe(400);
                expect(bodyJson.error).toBe('Bad Request');
                expect(bodyJson.message).toBe('headers must have required property \'x-site-uuid\'');
            });
        });    
    });
});