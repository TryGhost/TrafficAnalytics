import {afterEach, beforeEach, describe, expect, it, vi, type Mock} from 'vitest';
import fastify, {FastifyInstance} from 'fastify';
import botDetectionPlugin from '../../../src/plugins/bot-detection';
import {PAGE_HIT_ACCEPTED_RESPONSE} from '../../../src/utils/page-hit-response';

const routeOptions = {
    schema: {
        headers: {
            type: 'object',
            required: ['x-site-id'],
            properties: {
                'x-site-id': {type: 'string'}
            }
        }
    }
};

describe('bot detection plugin', () => {
    let app: FastifyInstance;
    let handler: Mock<() => void>;

    beforeEach(() => {
        vi.stubEnv('ENABLE_BOT_DETECTION_HEADER', undefined);
        app = fastify();
        handler = vi.fn();
        app.register(botDetectionPlugin);
        app.post('/page-hit', routeOptions, async (_request, reply) => {
            handler();
            return reply.status(202).send(PAGE_HIT_ACCEPTED_RESPONSE);
        });
    });

    afterEach(async () => {
        await app.close();
        vi.unstubAllEnvs();
    });

    it('should return 202 without invoking the handler for bot traffic', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/page-hit',
            headers: {
                'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
                'x-site-id': 'test-site'
            }
        });

        expect(response.statusCode).toBe(202);
        expect(response.json()).toEqual(PAGE_HIT_ACCEPTED_RESPONSE);
        expect(response.headers['x-ghost-bot-detected']).toBeUndefined();
        expect(handler).not.toHaveBeenCalled();
    });

    it('should include the bot detection header when enabled', async () => {
        vi.stubEnv('ENABLE_BOT_DETECTION_HEADER', 'true');

        const response = await app.inject({
            method: 'POST',
            url: '/page-hit',
            headers: {
                'user-agent': 'Googlebot/2.1',
                'x-site-id': 'test-site'
            }
        });

        expect(response.statusCode).toBe(202);
        expect(response.json()).toEqual(PAGE_HIT_ACCEPTED_RESPONSE);
        expect(response.headers['x-ghost-bot-detected']).toBe('true');
        expect(handler).not.toHaveBeenCalled();
    });

    it('should allow regular traffic to reach the handler', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/page-hit',
            headers: {
                'user-agent': 'Mozilla/5.0 Test Browser',
                'x-site-id': 'test-site'
            }
        });

        expect(response.statusCode).toBe(202);
        expect(response.json()).toEqual(PAGE_HIT_ACCEPTED_RESPONSE);
        expect(handler).toHaveBeenCalledOnce();
    });

    it('should run after schema validation', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/page-hit',
            headers: {
                'user-agent': 'Googlebot/2.1'
            }
        });

        expect(response.statusCode).toBe(400);
        expect(handler).not.toHaveBeenCalled();
    });
});
