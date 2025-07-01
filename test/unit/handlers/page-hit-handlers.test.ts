import {describe, it, expect, vi, beforeEach} from 'vitest';
import {FastifyReply} from 'fastify';
import {handlePageHitRequestStrategyBatch} from '../../../src/handlers/page-hit-handlers';
import {PageHitRequestType} from '../../../src/schemas';
import * as proxyModule from '../../../src/plugins/proxy';

// Mock the proxy module
vi.mock('../../../src/plugins/proxy', () => ({
    publishPageHitRaw: vi.fn()
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
                    post_type: 'null',
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
            send: vi.fn().mockReturnThis()
        } as unknown as FastifyReply;
    });

    describe('handlePageHitRequestStrategyBatch', () => {
        it('should publish page hit event and return 202 on success', async () => {
            const publishPageHitRawSpy = vi.spyOn(proxyModule, 'publishPageHitRaw').mockResolvedValue();

            await handlePageHitRequestStrategyBatch(mockRequest, mockReply);

            expect(publishPageHitRawSpy).toHaveBeenCalledWith(mockRequest);
            expect(mockReply.status).toHaveBeenCalledWith(202);
            expect(mockReply.send).toHaveBeenCalledWith({message: 'Page hit event received'});
            expect(mockRequest.log.error).not.toHaveBeenCalled();
        });

        it('should log error and continue when publishPageHitRaw throws an Error', async () => {
            const testError = new Error('Test error message');
            const publishPageHitRawSpy = vi.spyOn(proxyModule, 'publishPageHitRaw').mockRejectedValue(testError);

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
            const publishPageHitRawSpy = vi.spyOn(proxyModule, 'publishPageHitRaw').mockRejectedValue(testError);

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
            const publishPageHitRawSpy = vi.spyOn(proxyModule, 'publishPageHitRaw').mockRejectedValue(testError);

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
            const publishPageHitRawSpy = vi.spyOn(proxyModule, 'publishPageHitRaw').mockRejectedValue(testError);

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
            const publishPageHitRawSpy = vi.spyOn(proxyModule, 'publishPageHitRaw').mockRejectedValue(complexError);

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
});