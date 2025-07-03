import {FastifyReply, FastifyRequest} from 'fastify';
import {vi} from 'vitest';
import createApp from '../../src/app';
import {createPubSubSpy} from './pubsub-spy';
import {EventPublisher} from '../../src/services/events/publisher';

export const setupAppWithStubbedPreHandler = (preHandlerStub: (request: FastifyRequest, reply: FastifyReply, done: () => void) => void) => {
    const app = createApp();
    // Pre-handler stub is called after validation passes but before the request is processed
    app.addHook('preHandler', preHandlerStub);
    return app;
};

export const setupAppInBatchModeWithPubSubSpy = ({gcpProjectId, pageHitsRawTopic}: {gcpProjectId: string, pageHitsRawTopic: string}) => {
    // If these variables are set, app will run in batch mode
    // We should make this more explicit in the future, but for now this is how it works :/
    vi.stubEnv('GOOGLE_CLOUD_PROJECT', gcpProjectId);
    vi.stubEnv('PUBSUB_TOPIC_PAGE_HITS_RAW', pageHitsRawTopic);
    // Create a spy for the pubsub client and inject it into the EventPublisher singleton
    const pubSubSpy = createPubSubSpy();
    EventPublisher.resetInstance(pubSubSpy.mockPubSub as any);
    const app = createApp();
    return {app, pubSubSpy};
};

export const setupAppInProxyMode = () => {
    // If this variable is not set / undefined, the app defaults to proxy mode
    vi.stubEnv('PUBSUB_TOPIC_PAGE_HITS_RAW', undefined);
    const app = createApp();
    return app;
};