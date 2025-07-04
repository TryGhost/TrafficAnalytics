import {describe, it, expect, beforeAll} from 'vitest';
import {FastifyInstance} from 'fastify';
import {initializeApp} from '../../../../src/initializeApp';

describe('/api/v1/page_hit', () => {
    let app: FastifyInstance;

    beforeAll(async function () {
        app = await initializeApp({isWorkerMode: false});
    });

    it('should return 200', async function () {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/page_hit'
        });

        expect(response.statusCode).toBe(200);
        expect(response.body).toBe('Hello World');
    });
});