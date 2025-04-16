const {parseUserAgent} = require('../../../src/services/proxy/processors');
const assert = require('node:assert').strict;

describe('Processors', function () {
    describe('parseUserAgent', function () {
        it('should parse a desktop user agent', function () {
            const request = {
                headers: {
                    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
                },
                body: {
                    payload: {}
                },
                log: {error: () => {}}
            };
            parseUserAgent(request);

            assert.deepEqual(request.body.payload.meta, {
                os: 'macos',
                browser: 'chrome',
                device: 'desktop'
            });
        });

        it('should normalize mobile browser names', function () {
            const request = {
                headers: {
                    'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Mobile/15E148 Safari/604.1'
                },
                body: {
                    payload: {}
                },
                log: {error: () => {}}
            };
            parseUserAgent(request);
            // ua-parser-js returns 'Mobile Safari' before normalization
            assert.equal(request.body.payload.meta.browser, 'safari');
        });

        it('should normalize Mac OS and macOS to macos', function () {
            const request = {
                headers: {
                    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
                },
                body: {
                    payload: {}
                },
                log: {error: () => {}}
            };
            parseUserAgent(request);

            assert.equal(request.body.payload.meta.os, 'macos');
        });

        it('should identify obvious bots and set the device to bot', function () {
            const request = {
                headers: {
                    'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
                },
                body: {
                    payload: {}
                },
                log: {error: () => {}}
            };
            parseUserAgent(request);

            assert.equal(request.body.payload.meta.device, 'bot');
        });

        it('should return early if the user agent is not present', function () {
            const request = {
                headers: {},
                body: {
                    payload: {}
                },
                log: {error: () => {}}
            };
            parseUserAgent(request);

            assert.equal(request.body.payload.meta, undefined);
        });
    });
});
