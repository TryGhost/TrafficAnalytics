const {parseUserAgent} = require('../../../src/services/proxy/processors');
const assert = require('node:assert').strict;
describe('Processors', function () {
    describe('parseUserAgent', function () {
        it('should parse the user agent', function () {
            const request = {
                headers: {
                    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
                },
                body: {
                    payload: {}
                }
            };
            parseUserAgent(request);

            assert.deepEqual(request.body.payload.meta, {
                os: {name: 'Mac OS', version: '10.15.7'},
                browser: {name: 'Chrome', version: '91.0.4472.114', major: '91'},
                device: {type: undefined, vendor: 'Apple', model: 'Macintosh'}
            });
        });
    });
});
