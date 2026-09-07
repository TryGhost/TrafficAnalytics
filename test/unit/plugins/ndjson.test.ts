import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import fastify, {FastifyInstance} from 'fastify';
import ndjsonPlugin from '../../../src/plugins/ndjson';

describe('NDJSON plugin', () => {
    let app: FastifyInstance;

    beforeEach(() => {
        app = fastify();
        app.register(ndjsonPlugin);
        app.post('/events', async request => request.body);
    });

    afterEach(async () => {
        await app.close();
    });

    it('parses newline-delimited JSON', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/events',
            headers: {'content-type': 'application/x-ndjson'},
            payload: [
                '{"some":"thing"}',
                '{"foo":17,"bar":false,"quux":true}',
                '{"may":{"include":"nested","objects":["and","arrays"]}}'
            ].join('\n')
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual([
            {some: 'thing'},
            {foo: 17, bar: false, quux: true},
            {may: {include: 'nested', objects: ['and', 'arrays']}}
        ]);
    });

    it('accepts CRLF delimiters', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/events',
            headers: {'content-type': 'application/x-ndjson; charset=utf-8'},
            payload: '{"first":1}\r\n{"second":2}\r\n'
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual([{first: 1}, {second: 2}]);
    });

    it('ignores empty and whitespace-only lines', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/events',
            headers: {'content-type': 'application/x-ndjson'},
            payload: '\n  \n{"event":true}\n\n'
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual([{event: true}]);
    });

    it('accepts an empty body', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/events',
            headers: {'content-type': 'application/x-ndjson'},
            payload: ''
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual([]);
    });

    it('raises a bad request error for malformed JSON', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/events',
            headers: {'content-type': 'application/x-ndjson'},
            payload: '{"valid":true}\n{"invalid":}\n{"unreached":true}'
        });

        expect(response.statusCode).toBe(400);
        expect(response.json()).toMatchObject({
            error: 'Bad Request',
            message: 'Invalid NDJSON on line 2'
        });
    });
});
