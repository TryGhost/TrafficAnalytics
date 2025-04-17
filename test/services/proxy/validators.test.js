const validators = require('../../../dist/src/services/proxy/validators');
const {validateQueryParams, validateRequestBody} = validators;
const assert = require('node:assert').strict;

describe('Validators', function () {
    describe('validateQueryParams', function () {
        it('should throw an error if the token is not provided', function () {
            const request = {query: {token: ''}};
            assert.throws(() => validateQueryParams(request), Error);
        });

        it('should throw an error if the name is not provided', function () {
            const request = {query: {token: 'abc123', name: ''}};
            assert.throws(() => validateQueryParams(request), Error);
        });
    });

    describe('validateRequestBody', function () {
        it('should throw an error if the request body is not provided', function () {
            const request = {};
            assert.throws(() => validateRequestBody(request), Error);
        });

        it('should throw an error if the request body is empty', function () {
            const request = {body: {}};
            assert.throws(() => validateRequestBody(request), Error);
        });
    });
});
