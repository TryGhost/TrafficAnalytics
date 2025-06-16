import {FastifyRequest} from '../../../types';

export function handleSiteUUIDHeader(request: FastifyRequest): void {
    try {
        const siteUUID = request.headers['x-site-uuid'];

        if (typeof siteUUID !== 'string' || siteUUID === '') {
            return;
            //throw new Error('Bad Request: site_uuid is required and must be a string');
        }

        // Set the site_uuid on the request payload to be sent with the proxied request.
        request.body.payload.site_uuid = siteUUID;
    } catch (error) {
        request.log.error('Failed to get site UUID from request header:', error);
        throw error;
    }
}
