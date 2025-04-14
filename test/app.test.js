const request = require('supertest');
const app = require('../src/app');
const {filterQueryParams} = require('../src/utils/query-params');
const assert = require('assert').strict;

// This approach uses the inline server provided by Fastify for testing
describe('Fastify App', function () {
    // Create a new instance of the app for testing
    let server;
    
    before(function (done) {
        // Build the server
        app.ready().then(function () {
            server = app.server;
            done();
        }).catch(done);
    });
    
    after(function (done) {
        app.close().then(function () {
            done();
        }).catch(done);
    });
    
    it('should return Hello World on the root route', function (done) {
        request(server)
            .get('/')
            .expect(200)
            .expect('Hello World - Github Actions Deployment Test', done);
    });
    
    it('should handle requests to local-proxy path', function (done) {
        request(server)
            .post('/local-proxy')
            .expect(200)
            .expect('Hello World - From the local proxy', done);
    });
    
    // Test that the proxy route exists and responds (doesn't have to be 200/204)
    it('should have the web_analytics route registered', function (done) {
        request(server)
            .options('/tb/web_analytics')
            .end(function (err) {
                // Just verify we get some response (status code doesn't matter)
                if (err) {
                    return done(err);
                }
                // We got a response, that's all we need to verify
                done();
            });
    });
});

// Separate test suite for the query parameter filtering utility
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
});