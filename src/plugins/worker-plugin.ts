import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';
import {EventSubscriber} from '../services/events/subscriber';
import type {Message} from '@google-cloud/pubsub';

async function workerPlugin(fastify: FastifyInstance) {
    let subscriber: EventSubscriber | null = null;
    let heartbeatInterval: NodeJS.Timeout | null = null;

    // Start heartbeat logging when the app is ready
    fastify.ready(() => {
        fastify.log.info('Worker app started - beginning heartbeat logging');
        
        // Log heartbeat every 10 seconds
        heartbeatInterval = setInterval(() => {
            fastify.log.info('Worker heartbeat - processing events...');
        }, 10000);

        subscriber = new EventSubscriber(process.env.PUBSUB_SUBSCRIPTION_PAGE_HITS_RAW as string);
        subscriber.subscribe((message: Message) => {
            const messageData = message.data.toString();
            fastify.log.info({messageData}, 'Worker received message');
            message.ack();
        });
    });

    // Clean up resources when the app is closing
    fastify.addHook('onClose', async () => {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
        if (subscriber) {
            await subscriber.close();
        }
    });
}

export default fp(workerPlugin);