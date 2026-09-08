import fastify from 'fastify';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import tinybirdSyncRoutes from '../../../src/routes/v1/tinybird-sync';

describe('tinybird sync route', () => {
    let app: ReturnType<typeof fastify>;

    beforeEach(async () => {
        vi.stubEnv('TINYBIRD_SYNC_AUTH', 'sync-secret');
        app = fastify();
        await app.register(tinybirdSyncRoutes, {prefix: '/api/v1/tinybird-sync'});
        app.post('/unprotected', async () => ({ok: true}));
        await app.ready();
    });

    afterEach(async () => {
        await app.close();
    });

    it('should return 202 with an empty response body', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/tinybird-sync',
            headers: {
                authorization: 'Bearer sync-secret'
            }
        });

        expect(response.statusCode).toBe(202);
        expect(response.body).toBe('');
    });

    it('should reject invalid authorization', async () => {
        const authorizations = [undefined, 'Basic sync-secret', 'Bearer wrong-secret'];

        await Promise.all(authorizations.map(async (authorization) => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/tinybird-sync',
                headers: authorization ? {authorization} : undefined
            });

            expect(response.statusCode).toBe(401);
            expect(response.statusCode).not.toBe(202);
        }));
    });

    it('should reject requests when TINYBIRD_SYNC_AUTH is not configured', async () => {
        vi.stubEnv('TINYBIRD_SYNC_AUTH', undefined);
        const missingAuthApp = fastify();
        missingAuthApp.register(tinybirdSyncRoutes, {prefix: '/api/v1/tinybird-sync'});
        await missingAuthApp.ready();

        const response = await missingAuthApp.inject({
            method: 'POST',
            url: '/api/v1/tinybird-sync',
            headers: {
                authorization: 'Bearer sync-secret'
            }
        });

        expect(response.statusCode).toBe(401);
        await missingAuthApp.close();
    });

    it('should not apply authentication to routes outside tinybirdSyncRoutes', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/unprotected'
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ok: true});
    });
});
