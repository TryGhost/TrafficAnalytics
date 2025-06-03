import {describe, it, expect, vi, beforeEach} from 'vitest';
import {FastifyRequest} from '../../../../../src/types';
import {generateUserSignature} from '../../../../../src/services/proxy/processors/user-signature';

// Mock the user signature service
vi.mock('../../../../../src/services/user-signature', () => ({
    userSignatureService: {
        generateUserSignature: vi.fn()
    }
}));

import {userSignatureService} from '../../../../../src/services/user-signature';

describe('User Signature Processor', () => {
    let request: FastifyRequest;
    const mockUserSignature = 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890';

    beforeEach(() => {
        vi.clearAllMocks();

        // Create a partial FastifyRequest with the required properties for our tests
        request = {
            headers: {
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            },
            body: {
                payload: {
                    site_uuid: '940b73e9-4952-4752-b23d-9486f999c47e'
                }
            },
            ip: '192.168.1.1',
            log: {
                error: vi.fn()
            }
        } as unknown as FastifyRequest;

        // Setup default mock behavior
        vi.mocked(userSignatureService.generateUserSignature).mockResolvedValue(mockUserSignature);
    });

    it('should generate user signature and add it to meta', async () => {
        await generateUserSignature(request);

        expect(userSignatureService.generateUserSignature).toHaveBeenCalledWith(
            '940b73e9-4952-4752-b23d-9486f999c47e',
            '192.168.1.1',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        );

        expect(request.body.payload.meta).toEqual({
            userSignature: mockUserSignature
        });
    });

    it('should add user signature to existing meta object', async () => {
        request.body.payload.meta = {
            existingField: 'value'
        };

        await generateUserSignature(request);

        expect(request.body.payload.meta).toEqual({
            existingField: 'value',
            userSignature: mockUserSignature
        });
    });

    it('should skip if site_uuid is missing', async () => {
        delete request.body.payload.site_uuid;

        await generateUserSignature(request);

        expect(userSignatureService.generateUserSignature).not.toHaveBeenCalled();
        expect(request.body.payload.meta).toBeUndefined();
    });

    it('should skip if site_uuid is not a string', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        request.body.payload.site_uuid = 123 as any;

        await generateUserSignature(request);

        expect(userSignatureService.generateUserSignature).not.toHaveBeenCalled();
        expect(request.body.payload.meta).toBeUndefined();
    });

    it('should skip if IP address is missing', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        request.ip = undefined as any;

        await generateUserSignature(request);

        expect(userSignatureService.generateUserSignature).not.toHaveBeenCalled();
        expect(request.body.payload.meta).toBeUndefined();
    });

    it('should use empty string if user agent is missing', async () => {
        delete request.headers['user-agent'];

        await generateUserSignature(request);

        expect(userSignatureService.generateUserSignature).toHaveBeenCalledWith(
            '940b73e9-4952-4752-b23d-9486f999c47e',
            '192.168.1.1',
            ''
        );
    });

    it('should handle errors gracefully', async () => {
        const error = new Error('Test error');
        vi.mocked(userSignatureService.generateUserSignature).mockRejectedValue(error);

        await generateUserSignature(request);

        expect(request.log.error).toHaveBeenCalledWith('Failed to generate user signature:', error);
        expect(request.body.payload.meta).toBeUndefined();
    });

    it('should handle missing body gracefully', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        request.body = undefined as any;

        await generateUserSignature(request);

        expect(userSignatureService.generateUserSignature).not.toHaveBeenCalled();
    });

    it('should handle missing payload gracefully', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        request.body.payload = undefined as any;

        await generateUserSignature(request);

        expect(userSignatureService.generateUserSignature).not.toHaveBeenCalled();
    });
});