import fastify, {type FastifyInstance} from 'fastify';
import type {Message, Subscription} from '@google-cloud/pubsub';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import v1Routes from '../../src/routes/v1';
import {serializerCompiler, validatorCompiler} from '../../src/schemas';
import {createSubscription, deleteSubscription} from '../utils/pubsub';

const AUTOMATION_TOPIC = process.env.PUBSUB_TOPIC_AUTOMATION_EVENTS || 'test-traffic-analytics-automation-events';
const AUTOMATION_SUBSCRIPTION = process.env.PUBSUB_SUBSCRIPTION_AUTOMATION_EVENTS || 'test-traffic-analytics-automation-events-sub';
const SITE_UUID = '45d99892-6304-4251-a75d-2d9ff9c5b81f';

const automationRunEvent = () => ({
    type: 'automation_runs' as const,
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

describe('automation Pub/Sub publishing', () => {
    let app: FastifyInstance;
    let subscription: Subscription;

    beforeEach(async () => {
        vi.stubEnv('PUBSUB_TOPIC_AUTOMATION_EVENTS', AUTOMATION_TOPIC);
        subscription = await createSubscription(AUTOMATION_TOPIC, AUTOMATION_SUBSCRIPTION);

        app = fastify();
        app.setValidatorCompiler(validatorCompiler);
        app.setSerializerCompiler(serializerCompiler);
        await app.register(v1Routes, {prefix: '/api/v1'});
    });

    afterEach(async () => {
        await app.close();
        await subscription.close();
        await deleteSubscription(AUTOMATION_SUBSCRIPTION);
    });

    it('publishes a validated event through the route', async () => {
        const event = automationRunEvent();
        const receivedMessage = new Promise<Message>((resolve) => {
            subscription.once('message', resolve);
        });

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/automations',
            payload: event
        });
        const message = await receivedMessage;
        message.ack();

        expect(response.statusCode).toBe(202);
        expect(JSON.parse(message.data.toString())).toEqual(event);
    });
});
