const assert = require('assert/strict');
const request = require('supertest');
const app = require('../app');

describe('Express App', () => {
    it('should return "Hello World" on the root route', async () => {
        const response = await request(app)
            .get('/')
            .expect(200);

        assert.equal(response.text, 'Hello World');
    });
});
