import {FastifyError, FastifyRequest, FastifyReply} from 'fastify';

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
        // Only handle validation errors specifically
        if (error.statusCode === 400 && error.validation) {
            // Log validation error details with structured format
            reply.log.warn({
                err: {
                    message: error.message,
                    name: error.name,
                    code: error.code,
                    stack: error.stack,
                    validationContext: error.validationContext, // 'query', 'headers', 'body'
                    validation: error.validation // Array of validation errors
                },
                httpRequest: {
                    requestMethod: request.method,
                    requestUrl: request.url,
                    userAgent: request.headers['user-agent'],
                    remoteIp: request.ip,
                    referer: request.headers.referer,
                    status: 400
                },
                query: request.query,
                requestBody: request.body,
                type: 'validation_error'
            }, 'Schema validation failed');
            
            // Return structured error response to client
            return reply.status(400).send({
                error: 'Bad Request',
                message: error.message,
                statusCode: 400,
                validation: error.validation
            });
        }
        
        // For all other errors, log with proper stack trace and useful context
        reply.log.error({
            err: {
                message: error.message,
                name: error.name,
                code: error.code,
                stack: error.stack,
                statusCode: error.statusCode
            },
            httpRequest: {
                requestMethod: request.method,
                requestUrl: request.url,
                userAgent: request.headers['user-agent'],
                remoteIp: request.ip,
                referer: request.headers.referer
            },
            query: request.query,
            requestBody: request.body,
            type: 'unhandled_error'
        }, error.message);
        reply.send(error);
    };
}