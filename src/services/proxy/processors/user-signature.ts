import {FastifyRequest} from '../../../types';
import {userSignatureService} from '../../user-signature';

/**
 * Processes a request to generate a user signature.
 *
 * Extracts the site UUID from the request payload, IP address from the request,
 * and user agent from headers to generate a privacy-preserving user signature.
 * The signature is added to the request payload as meta.userSignature.
 * 
 * Throws an error if site_uuid or IP address is missing/invalid.
 *
 * @param request - The Fastify request object
 * @throws {Error} When site_uuid is missing or not a string
 * @throws {Error} When IP address is missing
 */
export async function generateUserSignature(request: FastifyRequest): Promise<void> {
    try {
        // Extract site UUID from payload
        const siteUuid = request.body?.payload?.site_uuid;
        if (!siteUuid || typeof siteUuid !== 'string') {
            throw new Error('Bad Request: site_uuid is required and must be a string');
        }

        // Extract IP address from request
        const ipAddress = request.ip;
        if (!ipAddress) {
            throw new Error('Bad Request: IP address is required');
        }

        // Extract user agent from headers
        const userAgent = request.headers['user-agent'] || '';

        // Generate user signature
        const userSignature = await userSignatureService.generateUserSignature(
            siteUuid,
            ipAddress,
            userAgent
        );

        // Ensure meta object exists
        if (!request.body.payload.meta) {
            request.body.payload.meta = {};
        }

        // Add user signature to payload
        request.body.payload.meta.userSignature = userSignature;
    } catch (error) {
        // Log error and re-throw to fail the request
        request.log.error('Failed to generate user signature:', error);
        throw error;
    }
}
