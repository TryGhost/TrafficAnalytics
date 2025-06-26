import {Message} from '@google-cloud/pubsub';
import {EventSubscriber} from '../events/subscriber';
import {PageHitRaw, PageHitRawSchema, PageHitProcessed, transformPageHitRawToProcessed} from '../../schemas';
import {Value} from '@sinclair/typebox/value';
import {TinybirdClient} from '../tinybird/client';
import logger from '../../utils/logger';

interface BatchWorkerConfig {
    batchSize?: number;
    flushInterval?: number;
}

interface PendingMessage {
    message: Message;
    processedEvent: PageHitProcessed;
}

class BatchWorker {
    private topic: string;
    private subscriber: EventSubscriber;
    private tinybirdClient: TinybirdClient;
    private batch: PendingMessage[];
    private batchSize: number;
    private flushInterval: number;
    private flushTimer: NodeJS.Timeout | null;
    private isShuttingDown: boolean;

    constructor(topic: string, tinybirdClient: TinybirdClient, config: BatchWorkerConfig = {}) {
        logger.info('Creating batch worker for topic: %s', topic);
        this.topic = topic;
        this.subscriber = new EventSubscriber(topic);
        this.tinybirdClient = tinybirdClient;
        this.batch = [];
        this.batchSize = config.batchSize || parseInt(process.env.BATCH_SIZE || '50', 10);
        this.flushInterval = config.flushInterval || parseInt(process.env.BATCH_FLUSH_INTERVAL_MS || '1000', 10);
        this.flushTimer = null;
        this.isShuttingDown = false;
        
        logger.info('Batch worker configured with batchSize: %d, flushInterval: %dms', this.batchSize, this.flushInterval);
    }

    public async start() {
        logger.info('Starting batch worker for topic: %s', this.topic);
        this.subscriber.subscribe(this.handleMessage.bind(this));
        this.scheduleFlush();
    }

    public async stop() {
        logger.info('Stopping batch worker for topic: %s', this.topic);
        this.isShuttingDown = true;
        
        // Cancel the flush timer
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        
        // Flush any remaining events
        await this.flushBatch();
        
        await this.subscriber.close();
    }

    private async handleMessage(message: Message) {
        try {
            const pageHitRaw = await this.parseMessage(message);
            const pageHitProcessed = await this.transformMessage(pageHitRaw);
            
            // Add to batch instead of posting immediately
            this.batch.push({
                message,
                processedEvent: pageHitProcessed
            });
            
            logger.info({pageHitProcessed}, 'Worker processed message and added to batch');
            
            // Check if batch is full
            if (this.batch.length >= this.batchSize) {
                await this.flushBatch();
            }
        } catch (error) {
            logger.error({messageData: message.data.toString(), error}, 'Worker unable to process message. Nacking message...');
            message.nack();
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

    private async flushBatch() {
        if (this.batch.length === 0) {
            return;
        }

        logger.info(`Flushing batch of ${this.batch.length} events to Tinybird`);
        const batchToFlush = [...this.batch];
        this.batch = [];
        
        try {
            const events = batchToFlush.map(item => item.processedEvent);
            await this.tinybirdClient.postEventBatch(events);
            
            // Acknowledge all messages in the batch
            batchToFlush.forEach((item) => {
                item.message.ack();
            });
            
            logger.info(`Successfully flushed batch of ${batchToFlush.length} events to Tinybird`);
        } catch (error) {
            logger.error({batchSize: batchToFlush.length, error}, 'Failed to flush batch to Tinybird');
            
            // Nack all messages in the failed batch
            batchToFlush.forEach((item) => {
                item.message.nack();
            });
            
            throw error;
        }
    }
    
    private scheduleFlush() {
        if (this.isShuttingDown || this.flushTimer) {
            return;
        }
        
        this.flushTimer = setTimeout(async () => {
            this.flushTimer = null;
            
            try {
                await this.flushBatch();
            } catch (error) {
                logger.error({error}, 'Error during scheduled batch flush');
            }
            
            // Schedule the next flush if not shutting down
            if (!this.isShuttingDown) {
                this.scheduleFlush();
            }
        }, this.flushInterval);
    }
}

export default BatchWorker;
export type {BatchWorkerConfig};