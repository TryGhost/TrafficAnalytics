import {describe, it, expect} from 'vitest';
import * as queryParams from '../../../src/utils/query-params';

const {filterQueryParams} = queryParams;

describe('Query Parameter Filtering', () => {
    it('should filter out unwanted query parameters while keeping token and name', () => {
        const input = '/api/v1/page_hit?token=abc123&name=test&unwanted=param';
        const expected = '/api/v1/page_hit?token=abc123&name=test';
        const result = filterQueryParams(input);
        expect(result).toBe(expected);
    });

    it('should remove all parameters if none are allowed', () => {
        const input = '/api/v1/page_hit?unwanted=param';
        const expected = '/api/v1/page_hit';
        const result = filterQueryParams(input);
        expect(result).toBe(expected);
    });

    it('should keep only token parameter if present', () => {
        const input = '/api/v1/page_hit?token=xyz';
        const expected = '/api/v1/page_hit?token=xyz';
        const result = filterQueryParams(input);
        expect(result).toBe(expected);
    });

    it('should keep only name parameter if present', () => {
        const input = '/api/v1/page_hit?name=test';
        const expected = '/api/v1/page_hit?name=test';
        const result = filterQueryParams(input);
        expect(result).toBe(expected);
    });

    // Edge cases for filterQueryParams
    it('should handle URLs with no query parameters', () => {
        const input = '/api/v1/page_hit';
        const expected = '/api/v1/page_hit';
        const result = filterQueryParams(input);
        expect(result).toBe(expected);
    });

    it('should handle empty query strings', () => {
        const input = '/api/v1/page_hit?';
        const expected = '/api/v1/page_hit';
        const result = filterQueryParams(input);
        expect(result).toBe(expected);
    });

    it('should reject requests with empty token and name', () => {
        const input = '/api/v1/page_hit?token=&name=';
        const expected = '/api/v1/page_hit';
        const result = filterQueryParams(input);
        expect(result).toBe(expected);
    });

    it('should reject whitespace-only token values', () => {
        const input = '/api/v1/page_hit?token=  &name=test';
        const expected = '/api/v1/page_hit?name=test';
        const result = filterQueryParams(input);
        expect(result).toBe(expected);
    });

    it('should reject whitespace-only name values', () => {
        const input = '/api/v1/page_hit?token=abc123&name=  ';
        const expected = '/api/v1/page_hit?token=abc123';
        const result = filterQueryParams(input);
        expect(result).toBe(expected);
    });

    it('should handle mixed valid and invalid values', () => {
        const input = '/api/v1/page_hit?token=valid&name=&extra=param';
        const expected = '/api/v1/page_hit?token=valid';
        const result = filterQueryParams(input);
        expect(result).toBe(expected);
    });
});
