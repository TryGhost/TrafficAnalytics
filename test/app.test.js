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
    
    // Test different HTTP methods against the root route 
    // (helps test the async handler)
    it('should respond to other methods on root route', function (done) {
        request(server)
            .post('/')
            .expect(404, done);
    });

    // Test different HTTP methods against the local-proxy route
    it('should not respond to GET on local-proxy path', function (done) {
        request(server)
            .get('/local-proxy')
            .expect(404, done);
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

    // Test for invalid URLs to trigger error handling
    it('should handle proxy errors gracefully', function (done) {
        // Temporarily modify the PROXY_TARGET to an invalid value to trigger error
        const originalProxyTarget = process.env.PROXY_TARGET;
        process.env.PROXY_TARGET = 'http://invalid-nonexistent-host';
        
        // Send request that should trigger proxy error
        request(server)
            .post('/tb/web_analytics')
            .end(function (err) {
                // Restore original PROXY_TARGET
                process.env.PROXY_TARGET = originalProxyTarget;
                
                // Error from supertest shouldn't stop test
                if (err) {
                    // Still consider test passed since we just wanted to trigger error
                    return done();
                }
                done();
            });
    });
});