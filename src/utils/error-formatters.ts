import {FastifyError, FastifyRequest} from 'fastify';

export class ErrorDataFormatter {
    static formatValidationError(error: FastifyError, request: FastifyRequest) {
        return {
            err: {
                message: error.message,
                name: error.name,
                code: error.code,
                stack: error.stack,
                validationContext: error.validationContext as 'body' | 'headers' | 'params',
                validation: error.validation
            },
            httpRequest: this.formatHttpRequest(request, error.statusCode),
            headers: this.formatHeaders(request),
            query: request.query,
            requestBody: request.body,
            type: 'validation_error'
        };
    }

    static formatUnhandledError(error: FastifyError, request: FastifyRequest) {
        return {
            err: {
                message: error.message,
                name: error.name,
                code: error.code,
                stack: error.stack,
                statusCode: error.statusCode
            },
            httpRequest: this.formatHttpRequest(request),
            headers: this.formatHeaders(request),
            query: request.query,
            requestBody: request.body,
            type: 'unhandled_error'
        };
    }

    private static formatHttpRequest(request: FastifyRequest, status?: number) {
        return {
            requestMethod: request.method,
            requestUrl: request.url,
            userAgent: request.headers['user-agent'],
            remoteIp: request.ip,
            referer: request.headers.referer,
            ...(status && {status})
        };
    }

    private static formatHeaders(request: FastifyRequest) {
        return {
            'content-type': request.headers['content-type'],
            'x-site-uuid': request.headers['x-site-uuid'],
            'user-agent': request.headers['user-agent'],
            referer: request.headers.referer
        };
    }
}

export class ErrorResponseFormatter {
    static formatResponse(error: FastifyError) {
        return {
            error: 'Bad Request',
            message: error.message,
            statusCode: error.statusCode,
            validation: error.validation
        };
    }
}
