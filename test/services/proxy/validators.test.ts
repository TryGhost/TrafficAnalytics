import { describe, it, expect } from 'vitest';
import * as validators from '../../../src/services/proxy/validators';
import { FastifyRequest } from '../../../src/types';

const { validateQueryParams, validateRequestBody } = validators;

describe('Validators', () => {
    describe('validateQueryParams', () => {
        it('should throw an error if the token is not provided', () => {
            const request = { query: { token: '' } } as FastifyRequest;
            expect(() => validateQueryParams(request)).toThrow();
        });

        it('should throw an error if the name is not provided', () => {
            const request = { query: { token: 'abc123', name: '' } } as FastifyRequest;
            expect(() => validateQueryParams(request)).toThrow();
        });
    });

    describe('validateRequestBody', () => {
        it('should throw an error if the request body is not provided', () => {
            const request = {} as FastifyRequest;
            expect(() => validateRequestBody(request)).toThrow();
        });

        it('should throw an error if the request body is empty', () => {
            const request = { body: {} } as FastifyRequest;
            expect(() => validateRequestBody(request)).toThrow();
        });
    });
}); 