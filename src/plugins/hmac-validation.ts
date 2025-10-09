import {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import fp from 'fastify-plugin';
import {getHmacValidationService} from '../services/hmac-validation';

async function hmacValidationPlugin(fastify: FastifyInstance) {
    // Skip HMAC validation if HMAC_SECRET is not set (for development/testing)
    if (!process.env.HMAC_SECRET) {
        fastify.log.warn('HMAC_SECRET not set - HMAC validation disabled');
        return;
    }

    // Check if we should only log failures instead of rejecting requests
    const logOnlyMode = process.env.HMAC_VALIDATION_LOG_ONLY === 'true';

    // Register global preValidation hook to intercept all requests
    fastify.addHook('preValidation', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            // Don't validate HMAC for read only requests
            if (['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(request.method) || request.url.startsWith('/local-proxy')) {
                return;
            }

            const hmacService = getHmacValidationService();

            // Validate HMAC and get cleaned URL
            const validationResult = await hmacService.validateRequest(request);

            if (!validationResult.isValid) {
                // Log security event for monitoring
                request.log.warn({
                    event: 'HmacValidationFailed',
                    url: request.url,
                    method: request.method,
                    ip: request.ip,
                    userAgent: request.headers['user-agent'],
                    error: validationResult.error,
                    type: 'security_validation_error',
                    logOnlyMode
                }, 'HMAC validation failed');

                // If in log-only mode, allow the request to continue
                if (logOnlyMode) {
                    // Update request.url to the cleaned version for downstream processing
                    request.raw.url = validationResult.cleanedUrl;
                    return;
                }

                // Return 401 Unauthorized
                reply.status(401).send({
                    error: 'Unauthorized',
                    message: validationResult.error || 'HMAC validation failed'
                });
                return;
            }

            // Update request.url to the cleaned version for downstream processing
            request.raw.url = validationResult.cleanedUrl;

            // Log successful validation (at debug level to avoid noise)
            request.log.debug({
                event: 'HmacValidationSuccess',
                originalUrl: validationResult.originalUrl,
                cleanedUrl: validationResult.cleanedUrl,
                method: request.method,
                ip: request.ip
            }, 'HMAC validation successful');
        } catch (error) {
            request.log.error({
                err: error instanceof Error ? {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                } : error,
                url: request.url,
                method: request.method,
                ip: request.ip,
                type: 'hmac_validation_error'
            }, 'Error during HMAC validation');

            // Return 500 for internal errors
            reply.status(500).send({
                error: 'Internal Server Error',
                message: 'HMAC validation failed due to internal error'
            });
        }
    });
}

// Export as fastify plugin
export default fp(hmacValidationPlugin);
