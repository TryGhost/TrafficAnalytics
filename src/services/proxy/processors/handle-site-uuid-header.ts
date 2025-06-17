import {FastifyRequest} from '../../../types';

export function handleSiteUUIDHeader(request: FastifyRequest): void {
    try {
        let siteUUID = request.headers['x-site-uuid'];

        // Match the validator logic: only process string values
        if (typeof siteUUID !== 'string') {
            siteUUID = '';
        }

        siteUUID = siteUUID.trim();

        // If no header value, check body payload as fallback
        if (siteUUID === '') {
            siteUUID = request.body?.payload?.site_uuid || '';
        }

        // If we still don't have a UUID, throw an error
        if (!siteUUID) {
            throw new Error('Site UUID is required but not found in header or body');
        }

        // Set the site_uuid on the request payload to be sent with the proxied request.
        request.body.payload.site_uuid = siteUUID;
    } catch (error) {
        request.log.error('Failed to get site UUID from request header:', error);
        throw error;
    }
}
