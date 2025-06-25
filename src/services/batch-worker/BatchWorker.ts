import {Message} from '@google-cloud/pubsub';
import {EventSubscriber} from '../events/subscriber';
import {PageHitRaw, PageHitRawSchema} from '../../schemas/v1/page-hit-raw';
import {transformPageHitRawToProcessed} from '../../schemas/v1/page-hit-processed';
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
        try {
            const pageHitRaw = await this.parseMessage(message);
            const pageHitProcessed = await this.transformMessage(pageHitRaw);

            logger.info({pageHitProcessed}, 'Worker processed message. Acknowledging message...');
            message.ack();
        } catch (error) {
            logger.error({messageData: message.data.toString(), error}, 'Worker unable to parse message. Nacking message...');
            message.nack();
            throw error;
        }
    }

    private async parseMessage(message: Message) {
        try {
            const messageData = message.data.toString();
            const json = JSON.parse(messageData);
            return Value.Parse(PageHitRawSchema, json);
        } catch (error) {
            logger.error({messageData: message.data.toString(), error}, 'Worker unable to parse message. Nacking message...');
            message.nack();
            throw error;
        }
    }

    private async transformMessage(pageHitRaw: PageHitRaw) {
        try {
            return await transformPageHitRawToProcessed(pageHitRaw);
        } catch (error) {
            logger.error({pageHitRaw, error}, 'Worker unable to transform message');
            throw error;
        }
    }
}

export default BatchWorker;