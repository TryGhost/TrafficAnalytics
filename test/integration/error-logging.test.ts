import {describe, it, expect, beforeEach, vi} from 'vitest';
import {FastifyError} from 'fastify';
import {errorHandler} from '../../src/utils/error-handler';

// Mock the logger methods
const mockWarn = vi.fn();
const mockError = vi.fn();

const mockRequest = {
    method: 'POST',
    url: '/test-endpoint',
    ip: '127.0.0.1',
    headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        referer: 'https://example.com/dashboard'
    },
    query: {page: '1', limit: '10'},
    body: {name: 'John Doe', email: 'john@example.com'}
} as any;

const mockReply = {
    log: {
        warn: mockWarn,
        error: mockError
    },
    status: vi.fn().mockReturnThis(),
    send: vi.fn()
} as any;

describe('Error Logging', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should log validation errors with stack traces', () => {
        const validationError = {
            statusCode: 400,
            code: 'FST_ERR_VALIDATION',
            validation: [
                {instancePath: '/name', schemaPath: '#/properties/name/type', keyword: 'type', params: {type: 'string'}, message: 'must be string'}
            ],
            validationContext: 'querystring',
            message: 'querystring must have required property "name"',
            name: 'FastifyError',
            stack: `FastifyError: querystring must have required property "name"
    at Object.validateInput (/app/node_modules/fastify/lib/validation.js:123:45)
    at preValidation (/app/node_modules/fastify/lib/hooks.js:234:56)
    at processTicksAndRejections (node:internal/process/task_queues.js:95:5)`
        } as FastifyError;

        const handler = errorHandler();
        handler(validationError, mockRequest, mockReply);

        // Verify validation error was logged with stack trace and useful request data
        expect(mockWarn).toHaveBeenCalledWith(
            expect.objectContaining({
                error: expect.objectContaining({
                    message: 'querystring must have required property "name"',
                    name: 'FastifyError',
                    code: 'FST_ERR_VALIDATION',
                    stack: expect.stringContaining('at Object.validateInput'),
                    validation: expect.any(Array)
                }),
                event: 'SchemaValidationFailed',
                httpRequest: expect.objectContaining({
                    userAgent: expect.any(String),
                    referer: expect.any(String)
                }),
                headers: expect.objectContaining({
                    'user-agent': expect.any(String),
                    referer: expect.any(String)
                }),
                query: expect.any(Object),
                requestBody: expect.any(Object),
                type: 'validation_error'
            })
        );

        // Verify the logged data structure
        const loggedData = mockWarn.mock.calls[0][0];
        expect(loggedData).toHaveProperty('error.stack');
        expect(loggedData).toHaveProperty('error.code');
        expect(loggedData).toHaveProperty('headers');
        expect(loggedData).toHaveProperty('query');
        expect(loggedData).toHaveProperty('requestBody');
    });

    it('should log unhandled errors with stack traces', () => {
        const unhandledError = {
            statusCode: 500,
            code: 'DATABASE_ERROR',
            message: 'Database connection failed',
            name: 'DatabaseError',
            stack: `DatabaseError: Database connection failed
    at DatabaseService.connect (/app/src/services/database.ts:45:23)
    at Object.handler (/app/src/routes/users.ts:12:34)
    at processTicksAndRejections (node:internal/process/task_queues.js:95:5)`
        } as FastifyError;

        const handler = errorHandler();
        handler(unhandledError, mockRequest, mockReply);

        // Verify unhandled error was logged with stack trace and useful request data
        expect(mockError).toHaveBeenCalledWith(
            expect.objectContaining({
                error: expect.objectContaining({
                    message: 'Database connection failed',
                    name: 'DatabaseError',
                    code: 'DATABASE_ERROR',
                    stack: expect.stringContaining('at DatabaseService.connect'),
                    statusCode: 500
                }),
                event: 'UnhandledError',
                httpRequest: expect.objectContaining({
                    userAgent: expect.any(String),
                    referer: expect.any(String)
                }),
                headers: expect.objectContaining({
                    'user-agent': expect.any(String),
                    referer: expect.any(String)
                }),
                query: expect.any(Object),
                requestBody: expect.any(Object),
                type: 'unhandled_error'
            })
        );

        // Verify the logged data structure
        const loggedData = mockError.mock.calls[0][0];
        expect(loggedData).toHaveProperty('error.stack');
        expect(loggedData).toHaveProperty('error.code');
        expect(loggedData).toHaveProperty('headers');
        expect(loggedData).toHaveProperty('query');
        expect(loggedData).toHaveProperty('requestBody');
    });

    it('should demonstrate the difference - old vs new logging', () => {
        const error = {
            statusCode: 500,
            code: 'SERVICE_ERROR',
            message: 'User service failed to process request',
            name: 'ServiceError',
            stack: `ServiceError: User service failed to process request
    at UserService.processUser (/app/src/services/user-service.ts:89:15)
    at UserController.createUser (/app/src/controllers/user-controller.ts:34:22)
    at Object.handler (/app/src/routes/users.ts:18:45)
    at processTicksAndRejections (node:internal/process/task_queues.js:95:5)`
        } as FastifyError;

        const handler = errorHandler();
        handler(error, mockRequest, mockReply);

        // Verify the new logging is cleaner and includes stack trace
        const loggedData = mockError.mock.calls[0][0];
        expect(loggedData).toHaveProperty('error.stack');
        expect(loggedData).toHaveProperty('error.code');
        expect(loggedData).toHaveProperty('headers');
        expect(loggedData).toHaveProperty('query');
        expect(loggedData).toHaveProperty('requestBody');
        expect(loggedData).toHaveProperty('httpRequest.userAgent');
        expect(loggedData).toHaveProperty('httpRequest.referer');
        expect(loggedData).toHaveProperty('type', 'unhandled_error');
    });
});
