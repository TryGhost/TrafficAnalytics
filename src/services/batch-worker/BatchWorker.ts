import {Message} from '@google-cloud/pubsub';
import {EventSubscriber} from '../events/subscriber';
import {PageHitRaw, PageHitRawSchema, PageHitProcessed, transformPageHitRawToProcessed} from '../../schemas';
import {Value} from '@sinclair/typebox/value';
import {TinybirdClient} from '../tinybird/client';
import logger from '../../utils/logger';

class BatchWorker {
    private topic: string;
    private subscriber: EventSubscriber;
    private tinybirdClient: TinybirdClient;

    constructor(topic: string, tinybirdClient: TinybirdClient) {
        logger.info('Creating batch worker for topic: %s', topic);
        this.topic = topic;
        this.subscriber = new EventSubscriber(topic);
        this.tinybirdClient = tinybirdClient;
    }

    public async start() {
        logger.info('Starting batch worker for topic: %s', this.topic);
        this.subscriber.subscribe(this.handleMessage.bind(this));
    }

    public async stop() {
        logger.info('Stopping batch worker for topic: %s', this.topic);
        await this.subscriber.close();
    }

    private async handleMessage(message: Message) {
        try {
            const pageHitRaw = await this.parseMessage(message);
            const pageHitProcessed = await this.transformMessage(pageHitRaw);
            await this.postToTinybird(pageHitProcessed);

            logger.info({pageHitProcessed}, 'Worker processed message and posted to Tinybird. Acknowledging message...');
            message.ack();
        } catch (error) {
            logger.error({messageData: message.data.toString(), error}, 'Worker unable to process message. Nacking message...');
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

    private async postToTinybird(pageHitProcessed: PageHitProcessed) {
        try {
            await this.tinybirdClient.postEvent(pageHitProcessed);
            logger.info({pageHitProcessed}, 'Successfully posted event to Tinybird');
        } catch (error) {
            logger.error({pageHitProcessed, error}, 'Failed to post event to Tinybird');
            throw error;
        }
    }
}

export default BatchWorker;