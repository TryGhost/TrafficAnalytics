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

    it('should generate user signature and set it as session_id', async () => {
        await generateUserSignature(request);

        expect(userSignatureService.generateUserSignature).toHaveBeenCalledWith(
            '940b73e9-4952-4752-b23d-9486f999c47e',
            '192.168.1.1',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        );

        expect(request.body.session_id).toEqual(mockUserSignature);
    });

    it('should overwrite existing session_id', async () => {
        request.body.session_id = 'existing-session-id';

        await generateUserSignature(request);

        expect(request.body.session_id).toEqual(mockUserSignature);
    });

    it('should throw error if site_uuid is missing', async () => {
        (request.body.payload as any).site_uuid = undefined;

        await expect(generateUserSignature(request)).rejects.toThrow('Bad Request: site_uuid is required and must be a string');

        expect(userSignatureService.generateUserSignature).not.toHaveBeenCalled();
    });

    it('should throw error if site_uuid is not a string', async () => {
        (request.body.payload as any).site_uuid = 123;

        await expect(generateUserSignature(request)).rejects.toThrow('Bad Request: site_uuid is required and must be a string');

        expect(userSignatureService.generateUserSignature).not.toHaveBeenCalled();
    });

    it('should throw error if IP address is missing', async () => {
        (request as any).ip = undefined;

        await expect(generateUserSignature(request)).rejects.toThrow('Bad Request: IP address is required');

        expect(userSignatureService.generateUserSignature).not.toHaveBeenCalled();
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

    it('should preserve existing meta object', async () => {
        request.body.payload.meta = {
            existingField: 'value'
        };

        await generateUserSignature(request);

        expect(request.body.payload.meta).toEqual({
            existingField: 'value'
        });
        expect(request.body.session_id).toEqual(mockUserSignature);
    });

    it('should log and re-throw errors from userSignatureService', async () => {
        const error = new Error('Test error');
        vi.mocked(userSignatureService.generateUserSignature).mockRejectedValue(error);

        await expect(generateUserSignature(request)).rejects.toThrow('Test error');

        expect(request.log.error).toHaveBeenCalledWith('Failed to generate user signature:', error);
    });

    it('should throw error if body is missing', async () => {
        (request.body as any) = undefined;

        await expect(generateUserSignature(request)).rejects.toThrow('Bad Request: site_uuid is required and must be a string');

        expect(userSignatureService.generateUserSignature).not.toHaveBeenCalled();
    });

    it('should throw error if payload is missing', async () => {
        (request.body as any).payload = undefined;

        await expect(generateUserSignature(request)).rejects.toThrow('Bad Request: site_uuid is required and must be a string');

        expect(userSignatureService.generateUserSignature).not.toHaveBeenCalled();
    });
});