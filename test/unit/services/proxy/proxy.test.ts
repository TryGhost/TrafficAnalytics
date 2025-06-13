import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {FastifyRequest, FastifyReply} from '../../../../src/types';
import {processRequest} from '../../../../src/services/proxy/proxy';

// Mock all the processor functions
vi.mock('../../../../src/services/proxy/processors/parse-user-agent', () => ({
    parseUserAgent: vi.fn()
}));

vi.mock('../../../../src/services/proxy/processors/url-referrer', () => ({
    parseReferrer: vi.fn()
}));

vi.mock('../../../../src/services/proxy/processors/user-signature', () => ({
    generateUserSignature: vi.fn()
}));

vi.mock('../../../../src/services/pubsub', () => ({
    publishEvent: vi.fn()
}));

import {parseUserAgent} from '../../../../src/services/proxy/processors/parse-user-agent';
import {parseReferrer} from '../../../../src/services/proxy/processors/url-referrer';
import {generateUserSignature} from '../../../../src/services/proxy/processors/user-signature';
import {publishEvent} from '../../../../src/services/pubsub';

describe('Proxy Service - processRequest', () => {
    let request: FastifyRequest;
    let reply: FastifyReply;
    let originalEnv: string | undefined;

    beforeEach(() => {
        vi.clearAllMocks();

        // Store original environment variable
        originalEnv = process.env.ENABLE_PUBSUB_PUBLISHING;

        // Create mock request and reply objects
        request = {
            headers: {
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            },
            body: {
                timestamp: '2025-04-14T22:16:06.095Z',
                action: 'page_hit',
                version: '1',
                session_id: '9017be4c-3065-484b-b117-9719ad1e3977',
                payload: {
                    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    locale: 'en-US',
                    location: 'US',
                    referrer: null,
                    pathname: '/',
                    href: 'https://www.example.com/',
                    site_uuid: '940b73e9-4952-4752-b23d-9486f999c47e',
                    post_uuid: 'undefined',
                    post_type: 'post',
                    member_uuid: 'undefined',
                    member_status: 'undefined'
                }
            },
            query: {
                token: 'abc123',
                name: 'test'
            },
            ip: '192.168.1.100',
            log: {
                error: vi.fn(),
                warn: vi.fn()
            }
        } as unknown as FastifyRequest;

        reply = {
            code: vi.fn().mockReturnThis(),
            send: vi.fn()
        } as unknown as FastifyReply;

        // Setup default mock behavior for processors
        vi.mocked(parseUserAgent).mockImplementation(() => {});
        vi.mocked(parseReferrer).mockImplementation(() => {});
        vi.mocked(generateUserSignature).mockResolvedValue(undefined);
        vi.mocked(publishEvent).mockResolvedValue(undefined);
    });

    afterEach(() => {
        // Restore original environment variable
        if (originalEnv === undefined) {
            delete process.env.ENABLE_PUBSUB_PUBLISHING;
        } else {
            process.env.ENABLE_PUBSUB_PUBLISHING = originalEnv;
        }
    });

    it('should process request with enrichment flow', async () => {
        await processRequest(request, reply);

        // Verify existing processors are called
        expect(parseUserAgent).toHaveBeenCalledWith(request);
        expect(parseReferrer).toHaveBeenCalledWith(request);
        expect(generateUserSignature).toHaveBeenCalledWith(request);
    });

    it('should handle enrichment processor errors and respond with 500', async () => {
        const processingError = new Error('User agent parsing failed');
        vi.mocked(parseUserAgent).mockImplementation(() => {
            throw processingError;
        });

        await expect(processRequest(request, reply)).rejects.toThrow('User agent parsing failed');

        // Verify error response
        expect(reply.code).toHaveBeenCalledWith(500);
        expect(reply.send).toHaveBeenCalledWith(processingError);
    });

    it('should handle async user signature generation errors', async () => {
        const signatureError = new Error('User signature generation failed');
        vi.mocked(generateUserSignature).mockRejectedValue(signatureError);

        await expect(processRequest(request, reply)).rejects.toThrow('User signature generation failed');

        // Verify error response
        expect(reply.code).toHaveBeenCalledWith(500);
        expect(reply.send).toHaveBeenCalledWith(signatureError);
    });

    it('should call enrichment processors in correct order', async () => {
        const callOrder: string[] = [];
        
        vi.mocked(parseUserAgent).mockImplementation(() => {
            callOrder.push('userAgent');
        });
        
        vi.mocked(parseReferrer).mockImplementation(() => {
            callOrder.push('referrer');
        });
        
        vi.mocked(generateUserSignature).mockImplementation(async () => {
            callOrder.push('signature');
        });
        await processRequest(request, reply);
        expect(callOrder).toEqual(['userAgent', 'referrer', 'signature']);
    });

    it('should not publish to Pub/Sub when feature flag is disabled', async () => {
        process.env.ENABLE_PUBSUB_PUBLISHING = 'false';
        process.env.PUBSUB_TOPIC_PAGE_HITS_RAW = 'test-topic';

        await processRequest(request, reply);

        expect(publishEvent).not.toHaveBeenCalled();
    });

    it('should publish to Pub/Sub when feature flag is enabled', async () => {
        process.env.ENABLE_PUBSUB_PUBLISHING = 'true';
        process.env.PUBSUB_TOPIC_PAGE_HITS_RAW = 'test-topic';

        await processRequest(request, reply);

        expect(publishEvent).toHaveBeenCalledWith('test-topic', {
            body: request.body,
            query: request.query,
            headers: {
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                referer: undefined
            },
            ip: '192.168.1.100'
        });
    });

    it('should handle Pub/Sub errors and continue with direct mode', async () => {
        process.env.ENABLE_PUBSUB_PUBLISHING = 'true';
        process.env.PUBSUB_TOPIC_PAGE_HITS_RAW = 'test-topic';
        
        vi.mocked(publishEvent).mockRejectedValue(new Error('Pub/Sub failed'));

        await processRequest(request, reply);

        // Should still process enrichment even if Pub/Sub fails
        expect(parseUserAgent).toHaveBeenCalledWith(request);
        expect(parseReferrer).toHaveBeenCalledWith(request);
        expect(generateUserSignature).toHaveBeenCalledWith(request);
        
        // Should log the error
        expect(request.log.error).toHaveBeenCalledWith({
            error: expect.any(Error),
            eventId: request.body.session_id,
            timestamp: request.body.timestamp
        }, 'Pub/Sub publishing failed after retry');
    });
});