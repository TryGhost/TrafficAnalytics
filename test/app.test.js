const request = require('supertest');
const app = require('../src/app');

describe('Express App', () => {
    it('should return "Hello World" on the root route', () => {
        return request(app)
            .get('/')
            .expect(200)
            .expect('Hello World - Github Actions Deployment Test');
    });
});
