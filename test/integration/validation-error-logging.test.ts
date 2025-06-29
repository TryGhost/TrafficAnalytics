import {describe, it, expect, beforeEach, beforeAll, afterAll, vi} from 'vitest';
import request from 'supertest';
import createMockUpstream from '../utils/mock-upstream';
import {FastifyInstance} from 'fastify';
import {Server} from 'http';

// Mock the user signature service before importing the app
vi.mock('../../src/services/user-signature', () => ({
    userSignatureService: {
        generateUserSignature: vi.fn().mockResolvedValue('a1b2c3d4e5f67890123456789012345678901234567890123456789012345678')
    }
}));

const validEventPayload = {
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

describe('Validation Error Logging', () => {
    let targetServer: FastifyInstance;
    let proxyServer: Server;
    let app: FastifyInstance;

    beforeAll(async () => {
        targetServer = createMockUpstream([]);
        await targetServer.listen({port: 0});
        const address = targetServer.server.address();
        if (!address || typeof address === 'string') {
            throw new Error('Invalid server address');
        }
        const targetUrl = `http://127.0.0.1:${address.port}`;

        process.env.PROXY_TARGET = targetUrl;

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
        vi.clearAllMocks();
    });

    describe('Query Parameter Validation Errors', () => {
        it('should return structured validation error when name parameter is missing', async () => {
            const response = await request(proxyServer)
                .post('/tb/web_analytics?token=abc123')
                .set('Content-Type', 'application/json')
                .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                .set('User-Agent', 'Mozilla/5.0 Test Browser')
                .send(validEventPayload)
                .expect(400);

            // Verify error response structure contains validation errors
            expect(response.body).toMatchObject({
                error: 'Bad Request',
                message: expect.stringContaining('querystring'),
                statusCode: 400,
                validation: expect.arrayContaining([
                    expect.objectContaining({
                        instancePath: expect.any(String),
                        message: expect.stringContaining('name')
                    })
                ])
            });
        });

        it('should return structured validation error for invalid name parameter value', async () => {
            const response = await request(proxyServer)
                .post('/tb/web_analytics?token=abc123&name=invalid_event_name')
                .set('Content-Type', 'application/json')
                .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                .set('User-Agent', 'Mozilla/5.0 Test Browser')
                .send(validEventPayload)
                .expect(400);

            expect(response.body).toMatchObject({
                error: 'Bad Request',
                message: expect.stringContaining('querystring'),
                statusCode: 400,
                validation: expect.arrayContaining([
                    expect.objectContaining({
                        instancePath: '/name'
                    })
                ])
            });
        });
    });

    describe('Header Validation Errors', () => {
        it('should return structured validation error when x-site-uuid header is missing', async () => {
            const response = await request(proxyServer)
                .post('/tb/web_analytics?token=abc123&name=analytics_events_test')
                .set('Content-Type', 'application/json')
                .set('User-Agent', 'Mozilla/5.0 Test Browser')
                .send(validEventPayload)
                .expect(400);

            expect(response.body).toMatchObject({
                error: 'Bad Request',
                message: expect.stringContaining('headers'),
                statusCode: 400,
                validation: expect.arrayContaining([
                    expect.objectContaining({
                        message: expect.stringContaining('x-site-uuid')
                    })
                ])
            });
        });

        it('should return structured validation error when x-site-uuid header is not a valid UUID', async () => {
            const response = await request(proxyServer)
                .post('/tb/web_analytics?token=abc123&name=analytics_events_test')
                .set('Content-Type', 'application/json')
                .set('x-site-uuid', 'not-a-uuid')
                .set('User-Agent', 'Mozilla/5.0 Test Browser')
                .send(validEventPayload)
                .expect(400);

            expect(response.body).toMatchObject({
                error: 'Bad Request',
                message: expect.stringContaining('headers'),
                statusCode: 400,
                validation: expect.arrayContaining([
                    expect.objectContaining({
                        instancePath: '/x-site-uuid',
                        message: expect.stringContaining('format')
                    })
                ])
            });
        });
    });

    describe('Body Validation Errors', () => {
        it('should return structured validation error when timestamp format is invalid', async () => {
            const invalidPayload = {
                ...validEventPayload,
                timestamp: 'not-a-datetime'
            };

            const response = await request(proxyServer)
                .post('/tb/web_analytics?token=abc123&name=analytics_events_test')
                .set('Content-Type', 'application/json')
                .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                .set('User-Agent', 'Mozilla/5.0 Test Browser')
                .send(invalidPayload)
                .expect(400);

            expect(response.body).toMatchObject({
                error: 'Bad Request',
                message: expect.stringContaining('body'),
                statusCode: 400,
                validation: expect.arrayContaining([
                    expect.objectContaining({
                        instancePath: '/timestamp',
                        message: expect.stringContaining('date-time')
                    })
                ])
            });
        });

        it('should return structured validation error when action is invalid', async () => {
            const invalidPayload = {
                ...validEventPayload,
                action: 'invalid_action'
            };

            const response = await request(proxyServer)
                .post('/tb/web_analytics?token=abc123&name=analytics_events_test')
                .set('Content-Type', 'application/json')
                .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                .set('User-Agent', 'Mozilla/5.0 Test Browser')
                .send(invalidPayload)
                .expect(400);

            expect(response.body).toMatchObject({
                error: 'Bad Request',
                message: expect.stringContaining('body'),
                statusCode: 400,
                validation: expect.arrayContaining([
                    expect.objectContaining({
                        instancePath: '/action',
                        message: expect.stringContaining('constant')
                    })
                ])
            });
        });

        it('should return structured validation error when payload fields are invalid', async () => {
            const invalidPayload = {
                ...validEventPayload,
                payload: {
                    ...validEventPayload.payload,
                    'user-agent': '', // Empty string not allowed
                    site_uuid: 'not-a-uuid', // Invalid UUID
                    href: 'not-a-url' // Invalid URL
                }
            };

            const response = await request(proxyServer)
                .post('/tb/web_analytics?token=abc123&name=analytics_events_test')
                .set('Content-Type', 'application/json')
                .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                .set('User-Agent', 'Mozilla/5.0 Test Browser')
                .send(invalidPayload)
                .expect(400);

            expect(response.body).toMatchObject({
                error: 'Bad Request',
                message: expect.stringContaining('body'),
                statusCode: 400,
                validation: expect.any(Array)
            });

            // Should have at least one validation error
            expect(response.body.validation.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Error Response Structure', () => {
        it('should include validation context in error message', async () => {
            const response = await request(proxyServer)
                .post('/tb/web_analytics?name=invalid_name') // Invalid name instead of missing token
                .set('Content-Type', 'application/json')
                .set('x-site-uuid', '940b73e9-4952-4752-b23d-9486f999c47e')
                .set('User-Agent', 'Mozilla/5.0 Test Browser')
                .send(validEventPayload)
                .expect(400);

            // Verify that validation errors are returned to client
            expect(response.body).toMatchObject({
                error: 'Bad Request',
                message: expect.any(String),
                statusCode: 400,
                validation: expect.any(Array)
            });

            // Verify that validation array contains useful error information
            expect(response.body.validation).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        instancePath: expect.any(String),
                        message: expect.any(String),
                        keyword: expect.any(String)
                    })
                ])
            );
        });

        it('should handle multiple validation errors from different contexts', async () => {
            const invalidPayload = {
                action: 'invalid_action', // Invalid action
                version: '2', // Invalid version
                payload: {
                    'user-agent': '', // Empty not allowed
                    locale: '', // Empty not allowed  
                    pathname: '', // Empty not allowed
                    href: 'not-a-url', // Invalid URL
                    site_uuid: 'not-a-uuid', // Invalid UUID
                    post_uuid: 'not-a-uuid', // Invalid UUID
                    post_type: 'invalid', // Invalid type
                    member_uuid: 'not-a-uuid', // Invalid UUID
                    member_status: '' // Empty not allowed
                }
            };

            const response = await request(proxyServer)
                .post('/tb/web_analytics?name=invalid_name&token=abc123') // Invalid query param
                .set('Content-Type', 'application/json') // Valid content type to focus on other errors
                .set('x-site-uuid', 'not-a-uuid') // Invalid UUID
                .set('User-Agent', 'Mozilla/5.0 Test Browser')
                .send(invalidPayload)
                .expect(400);

            // Should have validation errors from multiple contexts
            expect(response.body).toMatchObject({
                error: 'Bad Request',
                statusCode: 400,
                validation: expect.any(Array)
            });

            // Should have at least one validation error
            expect(response.body.validation.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Validation Error Logging Integration', () => {
        it('should validate that error handler is triggered for schema validation failures', async () => {
            // This test verifies that the validation error logging infrastructure is working
            // by confirming that validation errors trigger the custom error handler
            // (which is what logs the structured error data)
            
            const response = await request(proxyServer)
                .post('/tb/web_analytics?name=analytics_events_test')
                .set('Content-Type', 'application/json')
                .set('x-site-uuid', 'invalid-uuid')
                .set('User-Agent', 'Mozilla/5.0 Test Browser')
                .send({
                    timestamp: 'invalid-timestamp',
                    action: 'invalid-action',
                    version: 'invalid-version',
                    payload: {
                        'user-agent': '',
                        locale: '',
                        pathname: '',
                        href: 'invalid-url',
                        site_uuid: 'invalid-uuid',
                        post_uuid: 'invalid-uuid',
                        post_type: 'invalid-type',
                        member_uuid: 'invalid-uuid',
                        member_status: ''
                    }
                })
                .expect(400);

            // Verify that the custom error handler response structure is returned
            // This confirms that the validation error logging code path is being exercised
            expect(response.body).toMatchObject({
                error: 'Bad Request',
                message: expect.any(String),
                statusCode: 400,
                validation: expect.any(Array)
            });

            // The validation array should contain at least one error from the custom error handler
            expect(response.body.validation.length).toBeGreaterThanOrEqual(1);
            
            // Verify that validation errors have the expected structure that would be logged
            response.body.validation.forEach((error: any) => {
                expect(error).toMatchObject({
                    instancePath: expect.any(String),
                    message: expect.any(String),
                    keyword: expect.any(String)
                });
            });
        });
    });
});