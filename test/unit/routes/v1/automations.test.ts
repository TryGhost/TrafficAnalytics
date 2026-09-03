import fastify, {FastifyInstance} from 'fastify';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import v1Routes from '../../../../src/routes/v1';
import {serializerCompiler, validatorCompiler} from '../../../../src/schemas';

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
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/automations',
            payload: {type: 'automation_runs', id: 'run-1'}
        });

        expect(response.statusCode).toBe(202);
        expect(response.body).toBe('');
        expect(fetchMock).toHaveBeenCalledWith(
            'https://api.tinybird.co/v0/events?name=automation_run_events',
            expect.objectContaining({
                body: JSON.stringify({id: 'run-1'})
            })
        );
    });

    it('routes each NDJSON event to the mapped Tinybird datasource', async () => {
        const payload = [
            JSON.stringify({type: 'automation_runs', id: 'run-1'}),
            JSON.stringify({type: 'automation_run_steps', id: 'step-1'})
        ].join('\n');
        const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
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
        expect(consoleLogSpy).toHaveBeenCalledWith('Automation request body:', payload);
        expect(fetchMock).toHaveBeenNthCalledWith(
            1,
            'https://api.tinybird.co/v0/events?name=automation_run_events',
            expect.objectContaining({
                body: JSON.stringify({id: 'run-1'})
            })
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            'https://api.tinybird.co/v0/events?name=automation_run_step_events',
            expect.objectContaining({
                body: JSON.stringify({id: 'step-1'})
            })
        );
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
        expect(response.json()).toEqual({
            error: 'Unsupported automation event type on line 1: unknown_table'
        });
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
