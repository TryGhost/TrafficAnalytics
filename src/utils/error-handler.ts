import {FastifyError, FastifyRequest, FastifyReply} from 'fastify';
import {ErrorDataFormatter, ErrorResponseFormatter} from './error-formatters';

/**
 * Creates a structured validation error handler for Fastify that logs validation
 * errors with detailed context and returns consistent error responses.
 *
 * This handler specifically catches schema validation errors (statusCode 400 with validation property)
 * and logs them with structured data suitable for GCP logging and monitoring.
 *
 * @returns A Fastify error handler function
 */
export function errorHandler() {
    return (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
        const handleValidationErrors = error.statusCode === 400 && error.validation;

        if (handleValidationErrors) {
            const structuredLogData = ErrorDataFormatter.formatValidationError(error, request);
            const structuredResponseData = ErrorResponseFormatter.formatResponse(error);

            reply.log.warn(structuredLogData, 'Schema validation failed');
            return reply.status(400).send(structuredResponseData);
        }

        const structuredLogData = ErrorDataFormatter.formatUnhandledError(error, request);
        reply.log.error(structuredLogData, error.message);
        reply.send(error);
    };
}
