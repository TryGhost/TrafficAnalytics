import {describe, it, expect, beforeAll} from 'vitest';
import {FastifyInstance} from 'fastify';

describe('/api/v1/page_hit', () => {
    let fastify: FastifyInstance;

    beforeAll(async function () {
        const appModule = await import('../../../../src/app');
        fastify = appModule.default();
        await fastify.ready();
    });

    it('should return 200', async function () {
        const response = await fastify.inject({
            method: 'GET',
            url: '/api/v1/page_hit'
        });

        expect(response.statusCode).toBe(200);
        expect(response.body).toBe('Hello World');
    });
});