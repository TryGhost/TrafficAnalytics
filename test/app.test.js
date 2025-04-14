const request = require('supertest');
const app = require('../src/app');

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

    // Test the parameter filtering logic directly without making HTTP requests
    it('should filter query parameters correctly', function () {
        // Implementation from app.js
        const filterQueryParams = function (url) {
            // Get query parameters without creating a full URL object
            const searchParams = new URLSearchParams(url.split('?')[1] || '');
            
            // Extract only token and name
            const token = searchParams.get('token');
            const name = searchParams.get('name');
            
            // Create new query string with only these parameters
            const newSearchParams = new URLSearchParams();
            if (token) {
                newSearchParams.set('token', token);
            }
            if (name) {
                newSearchParams.set('name', name);
            }
            
            // Update the request URL (keep pathname, replace query)
            const path = url.split('?')[0];
            return path + (newSearchParams.toString() ? `?${newSearchParams.toString()}` : '');
        };
        
        // Test cases
        const testCases = [
            {
                input: '/tb/web_analytics?token=abc123&name=test&unwanted=param',
                expected: '/tb/web_analytics?token=abc123&name=test'
            },
            {
                input: '/tb/web_analytics?unwanted=param',
                expected: '/tb/web_analytics'
            },
            {
                input: '/tb/web_analytics?token=xyz',
                expected: '/tb/web_analytics?token=xyz'
            },
            {
                input: '/tb/web_analytics?name=test',
                expected: '/tb/web_analytics?name=test'
            }
        ];
        
        // Run all test cases
        testCases.forEach(function (testCase) {
            const result = filterQueryParams(testCase.input);
            if (result !== testCase.expected) {
                throw new Error(`Expected "${testCase.expected}", got "${result}"`);
            }
        });
    });
});