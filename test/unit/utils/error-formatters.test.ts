import {describe, it, expect} from 'vitest';
import {FastifyError, FastifyRequest} from 'fastify';
import {ErrorDataFormatter, ErrorResponseFormatter} from '../../../src/utils/error-formatters';

describe('Error Formatters', () => {
    const request = {
        method: 'POST',
        url: '/endpoint',
        ip: '127.0.0.1',
        headers: {
            'user-agent': 'USER AGENT',
            referer: 'https://example.com/referer',
            'content-type': 'application/json',
            'x-site-uuid': '940b73e9-4952-4752-b23d-9486f999c47e'
        },
        query: {page: '1', limit: '10'},
        body: {name: 'John Doe', email: 'john@example.com'}
    } as unknown as FastifyRequest;

    describe('ErrorDataFormatter', () => {
        describe('formatValidationError', () => {
            const validationError = {
                statusCode: 400,
                code: 'CODE',
                validation: [{instancePath: 'path', schemaPath: 'schemaPath'}],
                validationContext: 'querystring',
                message: 'error message',
                name: 'FastifyError',
                stack: 'FastifyStackError'
            } as FastifyError;

            it('should format validation error with all required fields', () => {
                const result = ErrorDataFormatter.formatValidationError(validationError, request);

                expect(result).toEqual({
                    err: {
                        message: 'error message',
                        name: 'FastifyError',
                        code: 'CODE',
                        stack: 'FastifyStackError',
                        validationContext: 'querystring',
                        validation: [{instancePath: 'path', schemaPath: 'schemaPath'}]
                    },
                    httpRequest: {
                        requestMethod: 'POST',
                        requestUrl: '/endpoint',
                        userAgent: 'USER AGENT',
                        remoteIp: '127.0.0.1',
                        referer: 'https://example.com/referer',
                        status: 400
                    },
                    headers: {
                        'content-type': 'application/json',
                        'x-site-uuid': '940b73e9-4952-4752-b23d-9486f999c47e',
                        'user-agent': 'USER AGENT',
                        referer: 'https://example.com/referer'
                    },
                    query: {page: '1', limit: '10'},
                    requestBody: {name: 'John Doe', email: 'john@example.com'},
                    type: 'validation_error'
                });
            });

            it('should handle missing headers gracefully', () => {
                const requestWithoutHeaders = {
                    ...request,
                    headers: {}
                } as unknown as FastifyRequest;

                const result = ErrorDataFormatter.formatValidationError(validationError, requestWithoutHeaders);

                expect(result.headers).toEqual({
                    'content-type': undefined,
                    'x-site-uuid': undefined,
                    'user-agent': undefined,
                    referer: undefined
                });
            });
        });

        describe('formatUnhandledError', () => {
            const unhandledError = {
                statusCode: 500,
                code: 'DATABASE_ERROR',
                message: 'Database connection failed',
                name: 'DatabaseError',
                stack: 'DatabaseStackError'
            } as FastifyError;

            it('should format unhandled error with all required fields', () => {
                const result = ErrorDataFormatter.formatUnhandledError(unhandledError, request);

                expect(result).toEqual({
                    err: {
                        message: 'Database connection failed',
                        name: 'DatabaseError',
                        code: 'DATABASE_ERROR',
                        stack: 'DatabaseStackError',
                        statusCode: 500
                    },
                    httpRequest: {
                        requestMethod: 'POST',
                        requestUrl: '/endpoint',
                        userAgent: 'USER AGENT',
                        remoteIp: '127.0.0.1',
                        referer: 'https://example.com/referer'
                    },
                    headers: {
                        'content-type': 'application/json',
                        'x-site-uuid': '940b73e9-4952-4752-b23d-9486f999c47e',
                        'user-agent': 'USER AGENT',
                        referer: 'https://example.com/referer'
                    },
                    query: {page: '1', limit: '10'},
                    requestBody: {name: 'John Doe', email: 'john@example.com'},
                    type: 'unhandled_error'
                });
            });

            it('should not include status in httpRequest for unhandled errors', () => {
                const result = ErrorDataFormatter.formatUnhandledError(unhandledError, request);

                expect(result.httpRequest).not.toHaveProperty('status');
            });
        });
    });

    describe('ErrorResponseFormatter', () => {
        describe('formatValidationResponse', () => {
            const validationError = {
                statusCode: 400,
                code: 'CODE',
                message: 'error message',
                name: 'FastifyError',
                validation: [{instancePath: '/name', message: 'must be string'}]
            } as FastifyError;

            it('should format validation response correctly', () => {
                const result = ErrorResponseFormatter.formatResponse(validationError);

                expect(result).toEqual({
                    error: 'Bad Request',
                    message: 'error message',
                    statusCode: 400,
                    validation: [{instancePath: '/name', message: 'must be string'}]
                });
            });
        });
    });
});
