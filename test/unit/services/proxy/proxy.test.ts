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
    publishRawEventToPubSub: vi.fn()
}));

import {parseUserAgent} from '../../../../src/services/proxy/processors/parse-user-agent';
import {parseReferrer} from '../../../../src/services/proxy/processors/url-referrer';
import {generateUserSignature} from '../../../../src/services/proxy/processors/user-signature';
import {publishRawEventToPubSub} from '../../../../src/services/pubsub';

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
        vi.mocked(publishRawEventToPubSub).mockResolvedValue(undefined);
    });

    afterEach(() => {
        // Restore original environment variable
        if (originalEnv === undefined) {
            delete process.env.ENABLE_PUBSUB_PUBLISHING;
        } else {
            process.env.ENABLE_PUBSUB_PUBLISHING = originalEnv;
        }
    });

    it('should process request with existing enrichment flow when PubSub is disabled', async () => {
        process.env.ENABLE_PUBSUB_PUBLISHING = 'false';

        await processRequest(request, reply);

        // Verify existing processors are called
        expect(parseUserAgent).toHaveBeenCalledWith(request);
        expect(parseReferrer).toHaveBeenCalledWith(request);
        expect(generateUserSignature).toHaveBeenCalledWith(request);

        // Verify PubSub publishing is NOT called
        expect(publishRawEventToPubSub).not.toHaveBeenCalled();
    });

    it('should publish raw event to PubSub when feature flag is enabled', async () => {
        process.env.ENABLE_PUBSUB_PUBLISHING = 'true';

        await processRequest(request, reply);

        // Verify PubSub publishing is called with raw data copy
        expect(publishRawEventToPubSub).toHaveBeenCalledWith(
            expect.objectContaining({
                body: request.body,
                query: request.query,
                headers: expect.objectContaining({
                    'user-agent': request.headers['user-agent']
                }),
                ip: request.ip
            })
        );

        // Verify existing processors are still called
        expect(parseUserAgent).toHaveBeenCalledWith(request);
        expect(parseReferrer).toHaveBeenCalledWith(request);
        expect(generateUserSignature).toHaveBeenCalledWith(request);
    });

    it('should not publish to PubSub when feature flag is undefined', async () => {
        delete process.env.ENABLE_PUBSUB_PUBLISHING;

        await processRequest(request, reply);

        // Verify PubSub publishing is NOT called
        expect(publishRawEventToPubSub).not.toHaveBeenCalled();

        // Verify existing processors are still called
        expect(parseUserAgent).toHaveBeenCalledWith(request);
        expect(parseReferrer).toHaveBeenCalledWith(request);
        expect(generateUserSignature).toHaveBeenCalledWith(request);
    });

    it('should continue processing even if PubSub publishing fails', async () => {
        process.env.ENABLE_PUBSUB_PUBLISHING = 'true';
        
        // Make PubSub publishing fail on both attempts
        const pubsubError = new Error('PubSub connection failed');
        vi.mocked(publishRawEventToPubSub).mockRejectedValue(pubsubError);

        await processRequest(request, reply);

        // Verify PubSub publishing was attempted twice (original + retry)
        expect(publishRawEventToPubSub).toHaveBeenCalledTimes(2);
        expect(publishRawEventToPubSub).toHaveBeenCalledWith(
            expect.objectContaining({
                body: request.body,
                query: request.query,
                headers: expect.objectContaining({
                    'user-agent': request.headers['user-agent']
                }),
                ip: request.ip
            })
        );

        // Verify error was logged with both errors
        expect(request.log.error).toHaveBeenCalledWith({
            originalError: pubsubError,
            retryError: pubsubError,
            eventId: request.body.session_id,
            timestamp: request.body.timestamp
        }, 'Pub/Sub publishing failed after retry');

        // Verify existing processors are still called (processing continues)
        expect(parseUserAgent).toHaveBeenCalledWith(request);
        expect(parseReferrer).toHaveBeenCalledWith(request);
        expect(generateUserSignature).toHaveBeenCalledWith(request);
    });

    it('should handle enrichment processor errors and respond with 500', async () => {
        process.env.ENABLE_PUBSUB_PUBLISHING = 'true';
        
        const processingError = new Error('User agent parsing failed');
        vi.mocked(parseUserAgent).mockImplementation(() => {
            throw processingError;
        });

        await expect(processRequest(request, reply)).rejects.toThrow('User agent parsing failed');

        // Verify error response
        expect(reply.code).toHaveBeenCalledWith(500);
        expect(reply.send).toHaveBeenCalledWith(processingError);

        // Verify PubSub publishing still happened before the error with raw data copy
        expect(publishRawEventToPubSub).toHaveBeenCalledWith(
            expect.objectContaining({
                body: request.body,
                query: request.query,
                headers: expect.objectContaining({
                    'user-agent': request.headers['user-agent']
                }),
                ip: request.ip
            })
        );
    });

    it('should handle async user signature generation errors', async () => {
        process.env.ENABLE_PUBSUB_PUBLISHING = 'true';
        
        const signatureError = new Error('User signature generation failed');
        vi.mocked(generateUserSignature).mockRejectedValue(signatureError);

        await expect(processRequest(request, reply)).rejects.toThrow('User signature generation failed');

        // Verify error response
        expect(reply.code).toHaveBeenCalledWith(500);
        expect(reply.send).toHaveBeenCalledWith(signatureError);

        // Verify PubSub publishing was called with raw data copy
        expect(publishRawEventToPubSub).toHaveBeenCalledWith(
            expect.objectContaining({
                body: request.body,
                query: request.query,
                headers: expect.objectContaining({
                    'user-agent': request.headers['user-agent']
                }),
                ip: request.ip
            })
        );
        expect(parseUserAgent).toHaveBeenCalledWith(request);
        expect(parseReferrer).toHaveBeenCalledWith(request);
    });

    it('should call processors in correct order: PubSub first, then enrichment', async () => {
        process.env.ENABLE_PUBSUB_PUBLISHING = 'true';
        
        const callOrder: string[] = [];
        
        vi.mocked(publishRawEventToPubSub).mockImplementation(async () => {
            callOrder.push('pubsub');
        });
        
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

        // Note: PubSub is fire-and-forget, so it may not complete before other processors
        // But it should be initiated first with raw data copy
        expect(publishRawEventToPubSub).toHaveBeenCalledWith(
            expect.objectContaining({
                body: request.body,
                query: request.query,
                headers: expect.objectContaining({
                    'user-agent': request.headers['user-agent']
                }),
                ip: request.ip
            })
        );
        expect(callOrder.slice(1)).toEqual(['userAgent', 'referrer', 'signature']);
    });

    it('should retry PubSub publishing on failure and succeed on retry', async () => {
        process.env.ENABLE_PUBSUB_PUBLISHING = 'true';
        
        // Make PubSub publishing fail first time, succeed on retry
        const pubsubError = new Error('Temporary PubSub failure');
        vi.mocked(publishRawEventToPubSub)
            .mockRejectedValueOnce(pubsubError)
            .mockResolvedValueOnce(undefined);

        await processRequest(request, reply);

        // Verify PubSub publishing was attempted twice
        expect(publishRawEventToPubSub).toHaveBeenCalledTimes(2);

        // Verify success warning was logged
        expect(request.log.warn).toHaveBeenCalledWith('Pub/Sub publishing succeeded on retry');

        // Verify no error was logged since retry succeeded
        expect(request.log.error).not.toHaveBeenCalled();

        // Verify existing processors are still called
        expect(parseUserAgent).toHaveBeenCalledWith(request);
        expect(parseReferrer).toHaveBeenCalledWith(request);
        expect(generateUserSignature).toHaveBeenCalledWith(request);
    });
});