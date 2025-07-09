import {describe, it, expect, vi, beforeEach} from 'vitest';
import {FastifyReply} from 'fastify';
import {handlePageHitRequestStrategyBatch, handlePageHitRequestStrategyInline} from '../../../src/handlers/page-hit-handlers';
import {PageHitRequestType} from '../../../src/schemas';
import * as publisherUtilsModule from '../../../src/services/events/publisherUtils';
import * as transformationsModule from '../../../src/transformations/page-hit-transformations';
import * as schemasModule from '../../../src/schemas/v1/page-hit-processed';

// Mock the proxy module
vi.mock('../../../src/services/events/publisherUtils', () => ({
    publishPageHitRaw: vi.fn()
}));

// Mock the transformations module
vi.mock('../../../src/transformations/page-hit-transformations', () => ({
    pageHitRawPayloadFromRequest: vi.fn()
}));

// Mock the schemas module
vi.mock('../../../src/schemas/v1/page-hit-processed', () => ({
    transformPageHitRawToProcessed: vi.fn()
}));

describe('page-hit-handlers', () => {
    let mockRequest: PageHitRequestType;
    let mockReply: FastifyReply;

    beforeEach(() => {
        vi.clearAllMocks();

        // Create a mock request object
        mockRequest = {
            method: 'POST',
            url: '/tb/web_analytics?token=test&name=analytics_events',
            ip: '192.168.1.1',
            protocol: 'https',
            raw: {
                httpVersion: '1.1'
            },
            query: {
                name: 'analytics_events'
            },
            headers: {
                'x-site-uuid': '123e4567-e89b-12d3-a456-426614174000',
                'content-type': 'application/json',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                referer: 'https://example.com'
            },
            body: {
                timestamp: '2023-01-01T00:00:00.000Z',
                action: 'page_hit',
                version: '1',
                payload: {
                    event_id: '456e7890-e89b-12d3-a456-426614174000',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    locale: 'en-US',
                    location: 'United States',
                    pathname: '/test',
                    href: 'https://example.com/test',
                    site_uuid: '123e4567-e89b-12d3-a456-426614174000',
                    post_uuid: 'undefined',
                    post_type: 'null' as const,
                    member_uuid: 'undefined',
                    member_status: 'undefined'
                }
            },
            log: {
                error: vi.fn()
            }
        } as unknown as PageHitRequestType;

        // Create a mock reply object
        mockReply = {
            status: vi.fn().mockReturnThis(),
            send: vi.fn().mockReturnThis(),
            from: vi.fn(),
            log: {
                error: vi.fn()
            },
            request: mockRequest
        } as unknown as FastifyReply;
    });

    describe('handlePageHitRequestStrategyBatch', () => {
        it('should publish page hit event and return 202 on success', async () => {
            const publishPageHitRawSpy = vi.spyOn(publisherUtilsModule, 'publishPageHitRaw').mockResolvedValue();

            await handlePageHitRequestStrategyBatch(mockRequest, mockReply);

            expect(publishPageHitRawSpy).toHaveBeenCalledWith(mockRequest);
            expect(mockReply.status).toHaveBeenCalledWith(202);
            expect(mockReply.send).toHaveBeenCalledWith({message: 'Page hit event received'});
            expect(mockRequest.log.error).not.toHaveBeenCalled();
        });

        it('should log error and continue when publishPageHitRaw throws an Error', async () => {
            const testError = new Error('Test error message');
            const publishPageHitRawSpy = vi.spyOn(publisherUtilsModule, 'publishPageHitRaw').mockRejectedValue(testError);

            await handlePageHitRequestStrategyBatch(mockRequest, mockReply);

            expect(publishPageHitRawSpy).toHaveBeenCalledWith(mockRequest);
            expect(mockRequest.log.error).toHaveBeenCalledWith(
                {
                    err: {
                        message: 'Test error message',
                        stack: testError.stack,
                        name: 'Error'
                    },
                    httpRequest: {
                        requestMethod: mockRequest.method,
                        requestUrl: mockRequest.url,
                        userAgent: mockRequest.headers['user-agent'],
                        remoteIp: mockRequest.ip,
                        referer: mockRequest.headers.referer,
                        protocol: `${mockRequest.protocol.toUpperCase()}/${mockRequest.raw.httpVersion}`,
                        status: 500
                    },
                    type: 'batch_processing_error'
                },
                'Failed to publish page hit event to batch queue'
            );
            expect(mockReply.status).toHaveBeenCalledWith(500);
            expect(mockReply.send).toHaveBeenCalledWith({error: 'Failed to process page hit event'});
        });

        it('should log error and continue when publishPageHitRaw throws a non-Error', async () => {
            const testError = 'String error';
            const publishPageHitRawSpy = vi.spyOn(publisherUtilsModule, 'publishPageHitRaw').mockRejectedValue(testError);

            await handlePageHitRequestStrategyBatch(mockRequest, mockReply);

            expect(publishPageHitRawSpy).toHaveBeenCalledWith(mockRequest);
            expect(mockRequest.log.error).toHaveBeenCalledWith(
                {
                    err: 'String error',
                    httpRequest: {
                        requestMethod: mockRequest.method,
                        requestUrl: mockRequest.url,
                        userAgent: mockRequest.headers['user-agent'],
                        remoteIp: mockRequest.ip,
                        referer: mockRequest.headers.referer,
                        protocol: `${mockRequest.protocol.toUpperCase()}/${mockRequest.raw.httpVersion}`,
                        status: 500
                    },
                    type: 'batch_processing_error'
                },
                'Failed to publish page hit event to batch queue'
            );
            expect(mockReply.status).toHaveBeenCalledWith(500);
            expect(mockReply.send).toHaveBeenCalledWith({error: 'Failed to process page hit event'});
        });

        it('should log error and continue when publishPageHitRaw throws null', async () => {
            const testError = null;
            const publishPageHitRawSpy = vi.spyOn(publisherUtilsModule, 'publishPageHitRaw').mockRejectedValue(testError);

            await handlePageHitRequestStrategyBatch(mockRequest, mockReply);

            expect(publishPageHitRawSpy).toHaveBeenCalledWith(mockRequest);
            expect(mockRequest.log.error).toHaveBeenCalledWith(
                {
                    err: null,
                    httpRequest: {
                        requestMethod: mockRequest.method,
                        requestUrl: mockRequest.url,
                        userAgent: mockRequest.headers['user-agent'],
                        remoteIp: mockRequest.ip,
                        referer: mockRequest.headers.referer,
                        protocol: `${mockRequest.protocol.toUpperCase()}/${mockRequest.raw.httpVersion}`,
                        status: 500
                    },
                    type: 'batch_processing_error'
                },
                'Failed to publish page hit event to batch queue'
            );
            expect(mockReply.status).toHaveBeenCalledWith(500);
            expect(mockReply.send).toHaveBeenCalledWith({error: 'Failed to process page hit event'});
        });

        it('should log error and continue when publishPageHitRaw throws undefined', async () => {
            const testError = undefined;
            const publishPageHitRawSpy = vi.spyOn(publisherUtilsModule, 'publishPageHitRaw').mockRejectedValue(testError);

            await handlePageHitRequestStrategyBatch(mockRequest, mockReply);

            expect(publishPageHitRawSpy).toHaveBeenCalledWith(mockRequest);
            expect(mockRequest.log.error).toHaveBeenCalledWith(
                {
                    err: undefined,
                    httpRequest: {
                        requestMethod: mockRequest.method,
                        requestUrl: mockRequest.url,
                        userAgent: mockRequest.headers['user-agent'],
                        remoteIp: mockRequest.ip,
                        referer: mockRequest.headers.referer,
                        protocol: `${mockRequest.protocol.toUpperCase()}/${mockRequest.raw.httpVersion}`,
                        status: 500
                    },
                    type: 'batch_processing_error'
                },
                'Failed to publish page hit event to batch queue'
            );
            expect(mockReply.status).toHaveBeenCalledWith(500);
            expect(mockReply.send).toHaveBeenCalledWith({error: 'Failed to process page hit event'});
        });

        it('should handle complex error objects', async () => {
            const complexError = {message: 'Complex error', code: 500, details: {nested: 'data'}};
            const publishPageHitRawSpy = vi.spyOn(publisherUtilsModule, 'publishPageHitRaw').mockRejectedValue(complexError);

            await handlePageHitRequestStrategyBatch(mockRequest, mockReply);

            expect(publishPageHitRawSpy).toHaveBeenCalledWith(mockRequest);
            expect(mockRequest.log.error).toHaveBeenCalledWith(
                {
                    err: complexError,
                    httpRequest: {
                        requestMethod: mockRequest.method,
                        requestUrl: mockRequest.url,
                        userAgent: mockRequest.headers['user-agent'],
                        remoteIp: mockRequest.ip,
                        referer: mockRequest.headers.referer,
                        protocol: `${mockRequest.protocol.toUpperCase()}/${mockRequest.raw.httpVersion}`,
                        status: 500
                    },
                    type: 'batch_processing_error'
                },
                'Failed to publish page hit event to batch queue'
            );
            expect(mockReply.status).toHaveBeenCalledWith(500);
            expect(mockReply.send).toHaveBeenCalledWith({error: 'Failed to process page hit event'});
        });
    });

    describe('handlePageHitRequestStrategyInline', () => {
        const mockPageHitRaw = {
            timestamp: '2023-01-01T00:00:00.000Z',
            action: 'page_hit' as const,
            version: '1' as const,
            site_uuid: '123e4567-e89b-12d3-a456-426614174000',
            payload: {
                event_id: '456e7890-e89b-12d3-a456-426614174000',
                member_uuid: 'undefined',
                member_status: 'undefined',
                post_uuid: 'undefined',
                post_type: 'null' as const,
                locale: 'en-US',
                location: 'United States',
                pathname: '/test',
                href: 'https://example.com/test',
                parsedReferrer: undefined,
                referrer: null
            },
            meta: {
                ip: '192.168.1.1',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };

        const mockPageHitProcessed = {
            timestamp: '2023-01-01T00:00:00.000Z',
            action: 'page_hit' as const,
            version: '1' as const,
            site_uuid: '123e4567-e89b-12d3-a456-426614174000',
            session_id: 'test-session-id',
            payload: {
                event_id: '456e7890-e89b-12d3-a456-426614174000',
                site_uuid: '123e4567-e89b-12d3-a456-426614174000',
                member_uuid: 'undefined',
                member_status: 'undefined',
                post_uuid: 'undefined',
                post_type: 'null' as const,
                locale: 'en-US',
                location: 'United States',
                pathname: '/test',
                href: 'https://example.com/test',
                os: 'windows',
                browser: 'chrome',
                device: 'desktop',
                referrerUrl: null,
                referrerSource: null,
                referrerMedium: null,
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };

        beforeEach(() => {
            delete process.env.PROXY_TARGET;
            delete process.env.TINYBIRD_TRACKER_TOKEN;
        });

        it('should transform request, proxy to upstream and handle success', async () => {
            const pageHitRawPayloadFromRequestSpy = vi.spyOn(transformationsModule, 'pageHitRawPayloadFromRequest').mockReturnValue(mockPageHitRaw);
            const transformPageHitRawToProcessedSpy = vi.spyOn(schemasModule, 'transformPageHitRawToProcessed').mockResolvedValue(mockPageHitProcessed);
            const fromSpy = vi.spyOn(mockReply, 'from').mockResolvedValue(undefined);

            await handlePageHitRequestStrategyInline(mockRequest, mockReply);

            expect(pageHitRawPayloadFromRequestSpy).toHaveBeenCalledWith(mockRequest);
            expect(transformPageHitRawToProcessedSpy).toHaveBeenCalledWith(mockPageHitRaw);
            expect(mockRequest.body).toBe(mockPageHitProcessed);
            expect(fromSpy).toHaveBeenCalledWith('http://localhost:3000/local-proxy', {
                queryString: expect.any(Function),
                rewriteRequestHeaders: expect.any(Function),
                onError: expect.any(Function)
            });
        });

        it('should use custom PROXY_TARGET when set', async () => {
            process.env.PROXY_TARGET = 'https://custom-target.com/api';

            const pageHitRawPayloadFromRequestSpy = vi.spyOn(transformationsModule, 'pageHitRawPayloadFromRequest').mockReturnValue(mockPageHitRaw);
            const transformPageHitRawToProcessedSpy = vi.spyOn(schemasModule, 'transformPageHitRawToProcessed').mockResolvedValue(mockPageHitProcessed);
            const fromSpy = vi.spyOn(mockReply, 'from').mockResolvedValue(undefined);

            await handlePageHitRequestStrategyInline(mockRequest, mockReply);

            expect(pageHitRawPayloadFromRequestSpy).toHaveBeenCalledWith(mockRequest);
            expect(transformPageHitRawToProcessedSpy).toHaveBeenCalledWith(mockPageHitRaw);
            expect(fromSpy).toHaveBeenCalledWith('https://custom-target.com/api', expect.any(Object));
        });

        it('should handle queryString rewriting - remove token when TINYBIRD_TRACKER_TOKEN is set', async () => {
            process.env.TINYBIRD_TRACKER_TOKEN = 'test-token';

            vi.spyOn(transformationsModule, 'pageHitRawPayloadFromRequest').mockReturnValue(mockPageHitRaw);
            vi.spyOn(schemasModule, 'transformPageHitRawToProcessed').mockResolvedValue(mockPageHitProcessed);
            const fromSpy = vi.spyOn(mockReply, 'from').mockResolvedValue(undefined);

            await handlePageHitRequestStrategyInline(mockRequest, mockReply);

            expect(fromSpy).toHaveBeenCalled();
            const fromCall = fromSpy.mock.calls[0];
            const options = fromCall[1];
            
            // Test the queryString function
            const mockReq = {
                query: {
                    token: 'original-token',
                    name: 'analytics_events',
                    other: 'param'
                }
            };
            const result = (options?.queryString as any)('', '', mockReq);
            
            expect(result).toBe('name=analytics_events&other=param');
            expect(result).not.toContain('token');
        });

        it('should handle queryString rewriting - keep token when TINYBIRD_TRACKER_TOKEN is not set', async () => {
            vi.spyOn(transformationsModule, 'pageHitRawPayloadFromRequest').mockReturnValue(mockPageHitRaw);
            vi.spyOn(schemasModule, 'transformPageHitRawToProcessed').mockResolvedValue(mockPageHitProcessed);
            const fromSpy = vi.spyOn(mockReply, 'from').mockResolvedValue(undefined);

            await handlePageHitRequestStrategyInline(mockRequest, mockReply);

            expect(fromSpy).toHaveBeenCalled();
            const fromCall = fromSpy.mock.calls[0];
            const options = fromCall[1];
            
            // Test the queryString function
            const mockReq = {
                query: {
                    token: 'original-token',
                    name: 'analytics_events',
                    other: 'param'
                }
            };
            const result = (options?.queryString as any)('', '', mockReq);
            
            expect(result).toBe('token=original-token&name=analytics_events&other=param');
        });

        it('should handle request header rewriting - add authorization when TINYBIRD_TRACKER_TOKEN is set', async () => {
            process.env.TINYBIRD_TRACKER_TOKEN = 'test-token';

            vi.spyOn(transformationsModule, 'pageHitRawPayloadFromRequest').mockReturnValue(mockPageHitRaw);
            vi.spyOn(schemasModule, 'transformPageHitRawToProcessed').mockResolvedValue(mockPageHitProcessed);
            const fromSpy = vi.spyOn(mockReply, 'from').mockResolvedValue(undefined);

            await handlePageHitRequestStrategyInline(mockRequest, mockReply);

            expect(fromSpy).toHaveBeenCalled();
            const fromCall = fromSpy.mock.calls[0];
            const options = fromCall[1];
            
            // Test the rewriteRequestHeaders function
            const mockReq = mockRequest;
            const originalHeaders = {
                'content-type': 'application/json',
                'user-agent': 'test-agent'
            };
            const result = options?.rewriteRequestHeaders!(mockReq, originalHeaders);
            
            expect(result).toEqual({
                'content-type': 'application/json',
                'user-agent': 'test-agent',
                authorization: 'Bearer test-token'
            });
        });

        it('should handle request header rewriting - keep headers unchanged when TINYBIRD_TRACKER_TOKEN is not set', async () => {
            vi.spyOn(transformationsModule, 'pageHitRawPayloadFromRequest').mockReturnValue(mockPageHitRaw);
            vi.spyOn(schemasModule, 'transformPageHitRawToProcessed').mockResolvedValue(mockPageHitProcessed);
            const fromSpy = vi.spyOn(mockReply, 'from').mockResolvedValue(undefined);

            await handlePageHitRequestStrategyInline(mockRequest, mockReply);

            expect(fromSpy).toHaveBeenCalled();
            const fromCall = fromSpy.mock.calls[0];
            const options = fromCall[1];
            
            // Test the rewriteRequestHeaders function
            const mockReq = mockRequest;
            const originalHeaders = {
                'content-type': 'application/json',
                'user-agent': 'test-agent'
            };
            const result = options?.rewriteRequestHeaders!(mockReq, originalHeaders);
            
            expect(result).toBe(originalHeaders);
        });

        it('should handle proxy errors with proper logging and response', async () => {
            vi.spyOn(transformationsModule, 'pageHitRawPayloadFromRequest').mockReturnValue(mockPageHitRaw);
            vi.spyOn(schemasModule, 'transformPageHitRawToProcessed').mockResolvedValue(mockPageHitProcessed);
            const fromSpy = vi.spyOn(mockReply, 'from').mockResolvedValue(undefined);

            await handlePageHitRequestStrategyInline(mockRequest, mockReply);

            expect(fromSpy).toHaveBeenCalled();
            const fromCall = fromSpy.mock.calls[0];
            const options = fromCall[1];
            
            // Test the onError function with Error object
            const testError = new Error('Proxy connection failed');
            const mockReplyInstance = {
                log: {
                    error: vi.fn()
                },
                status: vi.fn().mockReturnThis(),
                send: vi.fn(),
                request: mockRequest
            } as any;
            
            options?.onError!(mockReplyInstance, testError as any);
            
            expect(mockReplyInstance.log.error).toHaveBeenCalledWith({
                err: {
                    message: 'Proxy connection failed',
                    stack: testError.stack,
                    name: 'Error'
                },
                httpRequest: {
                    requestMethod: mockRequest.method,
                    requestUrl: mockRequest.url,
                    userAgent: mockRequest.headers['user-agent'],
                    remoteIp: mockRequest.ip,
                    referer: mockRequest.headers.referer,
                    protocol: `${mockRequest.protocol.toUpperCase()}/${mockRequest.raw.httpVersion}`,
                    status: 502
                },
                upstream: 'http://localhost:3000/local-proxy',
                type: 'proxy_error'
            }, 'Proxy error occurred');
            expect(mockReplyInstance.status).toHaveBeenCalledWith(502);
            expect(mockReplyInstance.send).toHaveBeenCalledWith({error: 'Proxy error'});
        });

        it('should handle proxy errors with wrapped error object', async () => {
            vi.spyOn(transformationsModule, 'pageHitRawPayloadFromRequest').mockReturnValue(mockPageHitRaw);
            vi.spyOn(schemasModule, 'transformPageHitRawToProcessed').mockResolvedValue(mockPageHitProcessed);
            const fromSpy = vi.spyOn(mockReply, 'from').mockResolvedValue(undefined);

            await handlePageHitRequestStrategyInline(mockRequest, mockReply);

            expect(fromSpy).toHaveBeenCalled();
            const fromCall = fromSpy.mock.calls[0];
            const options = fromCall[1];
            
            // Test the onError function with wrapped error
            const innerError = new Error('Connection timeout');
            const wrappedError = {error: innerError};
            const mockReplyInstance = {
                log: {
                    error: vi.fn()
                },
                status: vi.fn().mockReturnThis(),
                send: vi.fn(),
                request: mockRequest
            } as any;
            
            options?.onError!(mockReplyInstance, wrappedError as any);
            
            expect(mockReplyInstance.log.error).toHaveBeenCalledWith({
                err: {
                    message: 'Connection timeout',
                    stack: innerError.stack,
                    name: 'Error'
                },
                httpRequest: {
                    requestMethod: mockRequest.method,
                    requestUrl: mockRequest.url,
                    userAgent: mockRequest.headers['user-agent'],
                    remoteIp: mockRequest.ip,
                    referer: mockRequest.headers.referer,
                    protocol: `${mockRequest.protocol.toUpperCase()}/${mockRequest.raw.httpVersion}`,
                    status: 502
                },
                upstream: 'http://localhost:3000/local-proxy',
                type: 'proxy_error'
            }, 'Proxy error occurred');
            expect(mockReplyInstance.status).toHaveBeenCalledWith(502);
            expect(mockReplyInstance.send).toHaveBeenCalledWith({error: 'Proxy error'});
        });

        it('should handle transformation errors by allowing them to bubble up', async () => {
            const pageHitRawPayloadFromRequestSpy = vi.spyOn(transformationsModule, 'pageHitRawPayloadFromRequest').mockReturnValue(mockPageHitRaw);
            const transformError = new Error('Transformation failed');
            const transformPageHitRawToProcessedSpy = vi.spyOn(schemasModule, 'transformPageHitRawToProcessed').mockRejectedValue(transformError);

            await expect(handlePageHitRequestStrategyInline(mockRequest, mockReply)).rejects.toThrow('Transformation failed');

            expect(pageHitRawPayloadFromRequestSpy).toHaveBeenCalledWith(mockRequest);
            expect(transformPageHitRawToProcessedSpy).toHaveBeenCalledWith(mockPageHitRaw);
        });

        it('should handle pageHitRawPayloadFromRequest errors by allowing them to bubble up', async () => {
            const transformError = new Error('Raw payload transformation failed');
            const pageHitRawPayloadFromRequestSpy = vi.spyOn(transformationsModule, 'pageHitRawPayloadFromRequest').mockImplementation(() => {
                throw transformError;
            });

            await expect(handlePageHitRequestStrategyInline(mockRequest, mockReply)).rejects.toThrow('Raw payload transformation failed');

            expect(pageHitRawPayloadFromRequestSpy).toHaveBeenCalledWith(mockRequest);
        });
    });
});