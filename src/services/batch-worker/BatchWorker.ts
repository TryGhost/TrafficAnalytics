import {Message} from '@google-cloud/pubsub';
import {EventSubscriber} from '../events/subscriber';
import {PageHitRawSchema} from '../../schemas/v1/page-hit-raw';
import {Value} from '@sinclair/typebox/value';
import logger from '../../utils/logger';

class BatchWorker {
    private topic: string;
    private subscriber: EventSubscriber;

    constructor(topic: string) {
        logger.info('Creating batch worker for topic: %s', topic);
        this.topic = topic;
        this.subscriber = new EventSubscriber(topic);
    }

    public async start() {
        logger.info('Starting batch worker for topic: %s', this.topic);
        this.subscriber.subscribe(this.handleMessage);
    }

    public async stop() {
        logger.info('Stopping batch worker for topic: %s', this.topic);
        await this.subscriber.close();
    }

    private async handleMessage(message: Message) {
        const messageData = message.data.toString();
        try {
            const json = JSON.parse(messageData);
            const pageHitRaw = Value.Parse(PageHitRawSchema, json);
            logger.info({pageHitRaw}, 'Worker received valid message');
            message.ack();
        } catch (error) {
            logger.error({messageData, error}, 'Worker received invalid message');
            message.nack();
            throw error;
        }
    }
}

export default BatchWorker;