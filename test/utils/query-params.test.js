const {filterQueryParams} = require('../../src/utils/query-params');
const assert = require('assert').strict;

describe('Query Parameter Filtering', function () {
    it('should filter out unwanted query parameters while keeping token and name', function () {
        const input = '/tb/web_analytics?token=abc123&name=test&unwanted=param';
        const expected = '/tb/web_analytics?token=abc123&name=test';
        const result = filterQueryParams(input);
        assert.equal(result, expected);
    });

    it('should remove all parameters if none are allowed', function () {
        const input = '/tb/web_analytics?unwanted=param';
        const expected = '/tb/web_analytics';
        const result = filterQueryParams(input);
        assert.equal(result, expected);
    });

    it('should keep only token parameter if present', function () {
        const input = '/tb/web_analytics?token=xyz';
        const expected = '/tb/web_analytics?token=xyz';
        const result = filterQueryParams(input);
        assert.equal(result, expected);
    });

    it('should keep only name parameter if present', function () {
        const input = '/tb/web_analytics?name=test';
        const expected = '/tb/web_analytics?name=test';
        const result = filterQueryParams(input);
        assert.equal(result, expected);
    });

    // Edge cases for filterQueryParams
    it('should handle URLs with no query parameters', function () {
        const input = '/tb/web_analytics';
        const expected = '/tb/web_analytics';
        const result = filterQueryParams(input);
        assert.equal(result, expected);
    });

    it('should handle empty query strings', function () {
        const input = '/tb/web_analytics?';
        const expected = '/tb/web_analytics';
        const result = filterQueryParams(input);
        assert.equal(result, expected);
    });

    it('should reject requests with empty token and name', function () {
        const input = '/tb/web_analytics?token=&name=';
        const expected = '/tb/web_analytics';
        const result = filterQueryParams(input);
        assert.equal(result, expected);
    });
    
    it('should reject whitespace-only token values', function () {
        const input = '/tb/web_analytics?token=  &name=test';
        const expected = '/tb/web_analytics?name=test';
        const result = filterQueryParams(input);
        assert.equal(result, expected);
    });
    
    it('should reject whitespace-only name values', function () {
        const input = '/tb/web_analytics?token=abc123&name=  ';
        const expected = '/tb/web_analytics?token=abc123';
        const result = filterQueryParams(input);
        assert.equal(result, expected);
    });
    
    it('should handle mixed valid and invalid values', function () {
        const input = '/tb/web_analytics?token=valid&name=&extra=param';
        const expected = '/tb/web_analytics?token=valid';
        const result = filterQueryParams(input);
        assert.equal(result, expected);
    });
}); 