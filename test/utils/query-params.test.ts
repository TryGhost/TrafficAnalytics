import { describe, it, expect } from 'vitest';
import * as queryParams from '../../src/utils/query-params';

const { filterQueryParams } = queryParams;

describe('Query Parameter Filtering', () => {
    it('should filter out unwanted query parameters while keeping token and name', () => {
        const input = '/tb/web_analytics?token=abc123&name=test&unwanted=param';
        const expected = '/tb/web_analytics?token=abc123&name=test';
        const result = filterQueryParams(input);
        expect(result).toBe(expected);
    });

    it('should remove all parameters if none are allowed', () => {
        const input = '/tb/web_analytics?unwanted=param';
        const expected = '/tb/web_analytics';
        const result = filterQueryParams(input);
        expect(result).toBe(expected);
    });

    it('should keep only token parameter if present', () => {
        const input = '/tb/web_analytics?token=xyz';
        const expected = '/tb/web_analytics?token=xyz';
        const result = filterQueryParams(input);
        expect(result).toBe(expected);
    });

    it('should keep only name parameter if present', () => {
        const input = '/tb/web_analytics?name=test';
        const expected = '/tb/web_analytics?name=test';
        const result = filterQueryParams(input);
        expect(result).toBe(expected);
    });

    // Edge cases for filterQueryParams
    it('should handle URLs with no query parameters', () => {
        const input = '/tb/web_analytics';
        const expected = '/tb/web_analytics';
        const result = filterQueryParams(input);
        expect(result).toBe(expected);
    });

    it('should handle empty query strings', () => {
        const input = '/tb/web_analytics?';
        const expected = '/tb/web_analytics';
        const result = filterQueryParams(input);
        expect(result).toBe(expected);
    });

    it('should reject requests with empty token and name', () => {
        const input = '/tb/web_analytics?token=&name=';
        const expected = '/tb/web_analytics';
        const result = filterQueryParams(input);
        expect(result).toBe(expected);
    });
    
    it('should reject whitespace-only token values', () => {
        const input = '/tb/web_analytics?token=  &name=test';
        const expected = '/tb/web_analytics?name=test';
        const result = filterQueryParams(input);
        expect(result).toBe(expected);
    });
    
    it('should reject whitespace-only name values', () => {
        const input = '/tb/web_analytics?token=abc123&name=  ';
        const expected = '/tb/web_analytics?token=abc123';
        const result = filterQueryParams(input);
        expect(result).toBe(expected);
    });
    
    it('should handle mixed valid and invalid values', () => {
        const input = '/tb/web_analytics?token=valid&name=&extra=param';
        const expected = '/tb/web_analytics?token=valid';
        const result = filterQueryParams(input);
        expect(result).toBe(expected);
    });
}); 