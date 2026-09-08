import fastify from 'fastify';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import tinybirdSyncRoutes from '../../../src/routes/v1/tinybird-sync';
import * as publisherModule from '../../../src/services/events/publisher';

vi.mock('../../../src/services/events/publisher', () => ({
    publishEvent: vi.fn()
}));

describe('tinybird sync route', () => {
    let app: ReturnType<typeof fastify>;
    let fetchMock: ReturnType<typeof vi.fn>;

    const event = () => ({
        type: 'automation_runs',
        site_uuid: '45d99892-6304-4251-a75d-2d9ff9c5b81f',
        id: '6a99cd8cb5ac7c0052553383',
        updated_at: '2026-09-03T19:42:04.000Z',
        payload: {
            id: '6a99cd8cb5ac7c0052553383',
            automation_id: '6a99cd6cb5ac7c0052553378',
            created_at: '2026-09-03T19:42:04.000Z',
            updated_at: '2026-09-03T19:42:04.000Z',
            site_uuid: '45d99892-6304-4251-a75d-2d9ff9c5b81f'
        }
    });

    beforeEach(async () => {
        vi.stubEnv('TINYBIRD_SYNC_AUTH', 'sync-secret');
        vi.stubEnv('PUBSUB_TOPIC_TINYBIRD_SYNC', 'tinybird-sync-topic');
        vi.stubEnv('PROXY_TARGET', 'https://api.tinybird.co/v0/events');
        vi.stubEnv('TINYBIRD_TRACKER_TOKEN', 'test-token');
        vi.mocked(publisherModule.publishEvent).mockResolvedValue('message-id');
        fetchMock = vi.fn().mockResolvedValue({ok: true});
        vi.stubGlobal('fetch', fetchMock);
        app = fastify();
        await app.register(tinybirdSyncRoutes, {prefix: '/api/v1/tinybird-sync'});
        app.post('/unprotected', async () => ({ok: true}));
        await app.ready();
    });

    afterEach(async () => {
        await app.close();
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it('should reject a valid event sent as regular JSON', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/tinybird-sync',
            headers: {
                authorization: 'Bearer sync-secret'
            },
            payload: event()
        });

        expect(response.statusCode).toBe(415);
    });

    it('should reject a valid event batch sent as regular JSON', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/tinybird-sync',
            headers: {authorization: 'Bearer sync-secret'},
            payload: [event()]
        });

        expect(response.statusCode).toBe(415);
    });

    it('should return 202 for a valid NDJSON batch', async () => {
        const runStep = {
            type: 'automation_run_steps',
            site_uuid: event().site_uuid,
            id: '6a99cd8cb5ac7c0052553384',
            updated_at: '2026-09-03T19:42:04.000Z',
            payload: {
                id: '6a99cd8cb5ac7c0052553384',
                automation_run_id: '6a99cd8cb5ac7c0052553383',
                automation_action_revision_id: '6a99cd7db5ac7c005255337a',
                status: 'pending',
                step_attempts: 0,
                ready_at: '2026-09-04T19:42:04.000Z',
                started_at: null,
                finished_at: null,
                created_at: '2026-09-03T19:42:04.000Z',
                updated_at: '2026-09-03T19:42:04.000Z',
                site_uuid: event().site_uuid
            }
        };
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/tinybird-sync',
            headers: {
                authorization: 'Bearer sync-secret',
                'content-type': 'application/x-ndjson'
            },
            payload: `${JSON.stringify(event())}\n${JSON.stringify(runStep)}`
        });

        expect(response.statusCode).toBe(202);
        expect(response.body).toBe('');
        expect(publisherModule.publishEvent).toHaveBeenCalledTimes(2);
        expect(publisherModule.publishEvent).toHaveBeenNthCalledWith(1, {
            topic: 'tinybird-sync-topic',
            payload: event(),
            logger: expect.anything()
        });
        expect(publisherModule.publishEvent).toHaveBeenNthCalledWith(2, {
            topic: 'tinybird-sync-topic',
            payload: runStep,
            logger: expect.anything()
        });
    });

    it('should return 500 when publishing fails', async () => {
        vi.mocked(publisherModule.publishEvent).mockRejectedValue(new Error('Pub/Sub unavailable'));

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/tinybird-sync',
            headers: {
                authorization: 'Bearer sync-secret',
                'content-type': 'application/x-ndjson'
            },
            payload: JSON.stringify(event())
        });

        expect(response.statusCode).toBe(500);
    });

    it('should send events directly to Tinybird when the Pub/Sub topic is not configured', async () => {
        vi.stubEnv('PUBSUB_TOPIC_TINYBIRD_SYNC', undefined);
        const value = event();

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/tinybird-sync',
            headers: {
                authorization: 'Bearer sync-secret',
                'content-type': 'application/x-ndjson'
            },
            payload: JSON.stringify(value)
        });

        expect(response.statusCode).toBe(202);
        expect(publisherModule.publishEvent).not.toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledWith(
            'https://api.tinybird.co/v0/events?name=automation_run_events',
            expect.objectContaining({
                body: JSON.stringify({
                    site_uuid: value.site_uuid,
                    id: value.id,
                    updated_at: value.updated_at,
                    payload: value.payload
                })
            })
        );
    });

    it('should reject invalid payloads without coercing column types', async () => {
        const value = event();
        value.payload.automation_id = 'invalid';

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/tinybird-sync',
            headers: {
                authorization: 'Bearer sync-secret',
                'content-type': 'application/x-ndjson'
            },
            payload: JSON.stringify(value)
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toMatch(/payload\/automation_id/);
    });

    it('should reject unexpected payload fields', async () => {
        const value = event();

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/tinybird-sync',
            headers: {
                authorization: 'Bearer sync-secret',
                'content-type': 'application/x-ndjson'
            },
            payload: JSON.stringify({...value, payload: {...value.payload, secret: 'not-in-schema'}})
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toMatch(/additional properties/);
    });

    it('should reject an empty NDJSON batch', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/tinybird-sync',
            headers: {
                authorization: 'Bearer sync-secret',
                'content-type': 'application/x-ndjson'
            },
            payload: '\n'
        });

        expect(response.statusCode).toBe(400);
    });

    it('should reject unknown event types', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/tinybird-sync',
            headers: {
                authorization: 'Bearer sync-secret',
                'content-type': 'application/x-ndjson'
            },
            payload: JSON.stringify({...event(), type: 'unknown_table'})
        });

        expect(response.statusCode).toBe(400);
    });

    it('should reject NDJSON payloads larger than 10 MiB', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/tinybird-sync',
            headers: {
                authorization: 'Bearer sync-secret',
                'content-type': 'application/x-ndjson'
            },
            payload: `${JSON.stringify(event())}\n${' '.repeat(10 * 1024 * 1024)}`
        });

        expect(response.statusCode).toBe(413);
        expect(response.json()).toMatchObject({
            code: 'FST_ERR_CTP_BODY_TOO_LARGE',
            error: 'Payload Too Large'
        });
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
