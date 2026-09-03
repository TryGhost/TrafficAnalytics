import fastify, {FastifyInstance} from 'fastify';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import v1Routes from '../../../../src/routes/v1';
import {serializerCompiler, validatorCompiler} from '../../../../src/schemas';

const SITE_UUID = '45d99892-6304-4251-a75d-2d9ff9c5b81f';

const automationRunEvent = () => ({
    type: 'automation_runs',
    site_uuid: SITE_UUID,
    id: '6a99cd8cb5ac7c0052553383',
    updated_at: '2026-09-03T19:42:04.000Z',
    payload: {
        id: '6a99cd8cb5ac7c0052553383',
        automation_id: '6a99cd6cb5ac7c0052553378',
        created_at: '2026-09-03T19:42:04.000Z',
        updated_at: '2026-09-03T19:42:04.000Z',
        site_uuid: SITE_UUID
    }
});

const automationRunStepEvent = () => ({
    type: 'automation_run_steps',
    site_uuid: SITE_UUID,
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
        site_uuid: SITE_UUID
    }
});

describe('automations routes', () => {
    let app: FastifyInstance;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        vi.stubEnv('PROXY_TARGET', 'https://api.tinybird.co/v0/events');
        vi.stubEnv('TINYBIRD_TRACKER_TOKEN', 'test-token');
        fetchMock = vi.fn().mockResolvedValue({ok: true});
        vi.stubGlobal('fetch', fetchMock);

        app = fastify();
        app.setValidatorCompiler(validatorCompiler);
        app.setSerializerCompiler(serializerCompiler);
        await app.register(v1Routes, {prefix: '/api/v1'});
    });

    afterEach(async () => {
        await app.close();
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('accepts JSON POST requests', async () => {
        const event = automationRunEvent();
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/automations',
            payload: event
        });

        expect(response.statusCode).toBe(202);
        expect(response.body).toBe('');
        expect(fetchMock).toHaveBeenCalledWith(
            'https://api.tinybird.co/v0/events?name=automation_run_events',
            expect.objectContaining({
                body: JSON.stringify({
                    site_uuid: event.site_uuid,
                    id: event.id,
                    updated_at: event.updated_at,
                    payload: event.payload
                })
            })
        );
    });

    it('routes each NDJSON event to the mapped Tinybird datasource', async () => {
        const runEvent = automationRunEvent();
        const stepEvent = automationRunStepEvent();
        const payload = [
            JSON.stringify(runEvent),
            JSON.stringify(stepEvent)
        ].join('\n');
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/automations',
            headers: {
                'content-type': 'application/x-ndjson'
            },
            payload
        });

        expect(response.statusCode).toBe(202);
        expect(response.body).toBe('');
        expect(fetchMock).toHaveBeenNthCalledWith(
            1,
            'https://api.tinybird.co/v0/events?name=automation_run_events',
            expect.objectContaining({
                body: JSON.stringify({
                    site_uuid: runEvent.site_uuid,
                    id: runEvent.id,
                    updated_at: runEvent.updated_at,
                    payload: runEvent.payload
                })
            })
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            'https://api.tinybird.co/v0/events?name=automation_run_step_events',
            expect.objectContaining({
                body: JSON.stringify({
                    site_uuid: stepEvent.site_uuid,
                    id: stepEvent.id,
                    updated_at: stepEvent.updated_at,
                    payload: stepEvent.payload
                })
            })
        );
    });

    it('rejects an event missing a required payload field', async () => {
        const event = automationRunEvent();
        const payload: Record<string, unknown> = {...event.payload};
        delete payload.automation_id;

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/automations',
            headers: {
                'content-type': 'application/x-ndjson'
            },
            payload: JSON.stringify({...event, payload})
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toMatch(/body\/0\/payload.*automation_id/);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects an empty NDJSON body', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/automations',
            headers: {
                'content-type': 'application/x-ndjson'
            },
            payload: '\n'
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toMatch(/fewer than 1 items/);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects invalid payload column types', async () => {
        const event = automationRunStepEvent();

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/automations',
            headers: {
                'content-type': 'application/x-ndjson'
            },
            payload: JSON.stringify({
                ...event,
                payload: {...event.payload, step_attempts: '0'}
            })
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toMatch(/body\/0\/payload\/step_attempts/);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects invalid BSON ObjectIds', async () => {
        const event = automationRunStepEvent();

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/automations',
            headers: {
                'content-type': 'application/x-ndjson'
            },
            payload: JSON.stringify({
                ...event,
                payload: {...event.payload, automation_run_id: 'run-1'}
            })
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toMatch(/body\/0\/payload\/automation_run_id/);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects payload fields not included in the schema', async () => {
        const event = automationRunEvent();

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/automations',
            headers: {
                'content-type': 'application/x-ndjson'
            },
            payload: JSON.stringify({
                ...event,
                payload: {...event.payload, secret: 'not-in-schema'}
            })
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toMatch(/body\/0\/payload must NOT have additional properties/);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects events from unmapped Ghost tables', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/automations',
            headers: {
                'content-type': 'application/x-ndjson'
            },
            payload: JSON.stringify({type: 'unknown_table', id: 'event-1'})
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toMatch(/body\/0/);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reports invalid JSON with its NDJSON line number', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/automations',
            headers: {
                'content-type': 'application/x-ndjson'
            },
            payload: `${JSON.stringify(automationRunEvent())}\nnot-json`
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe('Invalid JSON on line 2');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not accept other request methods', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/automations'
        });

        expect(response.statusCode).toBe(404);
    });
});
