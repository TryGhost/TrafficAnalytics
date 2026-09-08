import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import request from 'supertest';
import {FastifyInstance} from 'fastify';

describe('Tinybird sync worker app', () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        vi.resetModules();
        const workerModule = await import('../../src/tinybird-sync-worker-app');
        app = workerModule.default;
        await app.ready();
    });

    afterEach(async () => {
        if (app) {
            await app.close();
        }
    });

    it('responds to GET / with healthy status', async () => {
        const response = await request(app.server)
            .get('/')
            .expect(200)
            .expect('content-type', /application\/json/);

        expect(response.body).toEqual({status: 'tinybird-sync-healthy'});
    });

    it('responds to GET /health with healthy status', async () => {
        const response = await request(app.server)
            .get('/health')
            .expect(200)
            .expect('content-type', /application\/json/);

        expect(response.body).toEqual({status: 'tinybird-sync-healthy'});
    });

    it('does not expose ingest routes', async () => {
        await request(app.server)
            .post('/api/v1/page_hit')
            .send({})
            .expect(404);
    });
});
