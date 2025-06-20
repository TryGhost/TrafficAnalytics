import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';
import {EventSubscriber} from '../services/events/subscriber';
import config from '@tryghost/config';

async function batchWorkerPlugin(fastify: FastifyInstance) {
    const subscriber = new EventSubscriber();
    
    // Start subscription when Fastify is ready
    fastify.addHook('onReady', async () => {
        const projectId = config.get<string>('GOOGLE_CLOUD_PROJECT') || config.get<string>('GCP_PROJECT_ID');
        if (!projectId) {
            throw new Error('GOOGLE_CLOUD_PROJECT or GCP_PROJECT_ID environment variable is required for worker mode');
        }
        
        const subscriptionName = config.get<string>('PUBSUB_SUBSCRIPTION_NAME') || 'page-hits-raw-subscription';
        const topicName = config.get<string>('PUBSUB_TOPIC_NAME') || 'page-hits-raw';
        
        try {
            await subscriber.start({
                projectId,
                subscriptionName,
                topicName,
                logger: fastify.log
            });
            fastify.log.info({
                projectId,
                subscriptionName,
                topicName
            }, 'Batch worker subscription started');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            fastify.log.error({
                error: errorMessage,
                projectId,
                subscriptionName,
                topicName
            }, 'Failed to start batch worker subscription');
            throw error;
        }
    });
    
    // Clean shutdown when Fastify closes
    fastify.addHook('onClose', async () => {
        try {
            await subscriber.stop();
            fastify.log.info('Batch worker subscription stopped');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            fastify.log.error({
                error: errorMessage
            }, 'Error stopping batch worker subscription');
            // Don't throw here - we want shutdown to continue even if subscription cleanup fails
        }
    });
}

export default fp(batchWorkerPlugin);