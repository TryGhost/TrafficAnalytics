import {FastifyRequest} from '../../../types';
import {userSignatureService} from '../../user-signature';

/**
 * Processes a request to generate a user signature.
 *
 * Extracts the site UUID from the request payload, IP address from the request,
 * and user agent from headers to generate a privacy-preserving user signature.
 * The signature is added to the request payload as meta.userSignature.
 *
 * @param request - The Fastify request object
 */
export async function generateUserSignature(request: FastifyRequest): Promise<void> {
    try {
        // Extract site UUID from payload
        const siteUuid = request.body?.payload?.site_uuid;
        if (!siteUuid || typeof siteUuid !== 'string') {
            // Skip if no valid site UUID
            return;
        }

        // Extract IP address from request
        const ipAddress = request.ip;
        if (!ipAddress) {
            // Skip if no IP address
            return;
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
        // Log error but don't fail the request
        request.log.error('Failed to generate user signature:', error);
    }
}
