import type {Message} from '@google-cloud/pubsub';
import {TinybirdSyncEventSchema, createValidator, type TinybirdSyncEvent} from '../../schemas';
import logger from '../../utils/logger';
import {EventSubscriber} from '../events/subscriber';
import {TINYBIRD_SYNC_EVENT_DATASOURCES, TINYBIRD_SYNC_EVENT_TYPES} from '../tinybird/tinybird-sync';
import type {TinybirdClient, TinybirdEvent} from '../tinybird/client';

const validateTinybirdSyncEvent = createValidator(TinybirdSyncEventSchema);

export type TinybirdSyncBatchWorkerConfig = {
    batchSize: number;
    flushInterval: number;
};

export type TinybirdSyncClients = Record<TinybirdSyncEvent['type'], Pick<TinybirdClient, 'postEventBatch'>>;

type PendingMessage = {
    message: Message;
    event: TinybirdEvent;
};

function parseMessage(message: Message): TinybirdSyncEvent | null {
    try {
        return validateTinybirdSyncEvent(JSON.parse(message.data.toString()));
    } catch (err) {
        logger.error({event: 'TinybirdSyncWorkerMessageParsingFailed', messageId: message.id, err});
        return null;
    }
}

class TinybirdSyncBatchWorker {
    #subscriptionName: string;
    #subscriber: EventSubscriber;
    #tinybirdClients: TinybirdSyncClients;
    #batches: Record<TinybirdSyncEvent['type'], PendingMessage[]>;
    #batchSize: number;
    #flushInterval: number;
    #flushTimer: NodeJS.Timeout | null;
    #isShuttingDown: boolean;

    constructor(subscriptionName: string, tinybirdClients: TinybirdSyncClients, config: TinybirdSyncBatchWorkerConfig) {
        logger.info({event: 'TinybirdSyncBatchWorkerCreating', subscriptionName});
        this.#subscriptionName = subscriptionName;
        this.#subscriber = new EventSubscriber(subscriptionName);
        this.#tinybirdClients = tinybirdClients;
        this.#batches = {
            automation_runs: [],
            automation_run_steps: []
        };
        this.#batchSize = config.batchSize;
        this.#flushInterval = config.flushInterval;
        this.#flushTimer = null;
        this.#isShuttingDown = false;

        logger.info({
            event: 'TinybirdSyncBatchWorkerConfigured',
            batchSize: this.#batchSize,
            flushIntervalMs: this.#flushInterval
        });
    }

    public start(): void {
        logger.info({event: 'TinybirdSyncBatchWorkerStarting', subscriptionName: this.#subscriptionName});
        this.#subscriber.subscribe(this.#handleMessage.bind(this));
        this.#scheduleFlush();
    }

    public async stop(): Promise<void> {
        if (this.#isShuttingDown) {
            return;
        }

        logger.info({event: 'TinybirdSyncBatchWorkerStopping', subscriptionName: this.#subscriptionName});
        this.#isShuttingDown = true;

        if (this.#flushTimer) {
            clearTimeout(this.#flushTimer);
            this.#flushTimer = null;
        }

        await this.#subscriber.close();
        await this.#flushAllBatches();
    }

    async #handleMessage(message: Message): Promise<void> {
        const tinybirdSyncEvent = parseMessage(message);
        if (!tinybirdSyncEvent) {
            message.nack();
            return;
        }

        const {type, ...event} = tinybirdSyncEvent;
        this.#batches[type].push({message, event});

        logger.debug({
            event: 'TinybirdSyncWorkerQueuedEvent',
            messageId: message.id,
            tinybirdSyncEventId: tinybirdSyncEvent.id,
            tinybirdSyncEventType: type,
            batchSize: this.#batches[type].length
        });

        if (this.#batches[type].length >= this.#batchSize) {
            await this.#flushBatch(type);
        }
    }

    async #flushBatch(type: TinybirdSyncEvent['type']): Promise<void> {
        const batch = this.#batches[type];
        if (batch.length === 0) {
            return;
        }

        this.#batches[type] = [];

        try {
            await this.#tinybirdClients[type].postEventBatch(batch.map(item => item.event));
            batch.forEach(item => item.message.ack());

            logger.info({
                event: 'TinybirdSyncWorkerFlushedBatch',
                tinybirdSyncEventType: type,
                datasource: TINYBIRD_SYNC_EVENT_DATASOURCES[type],
                batchSize: batch.length,
                messageIds: batch.map(item => item.message.id)
            });
        } catch (err) {
            logger.error({
                event: 'TinybirdSyncWorkerBatchFlushFailed',
                tinybirdSyncEventType: type,
                datasource: TINYBIRD_SYNC_EVENT_DATASOURCES[type],
                batchSize: batch.length,
                messageIds: batch.map(item => item.message.id),
                err
            });
            batch.forEach(item => item.message.nack());
        }
    }

    async #flushAllBatches(): Promise<void> {
        await Promise.all(TINYBIRD_SYNC_EVENT_TYPES.map(type => this.#flushBatch(type)));
    }

    #scheduleFlush(): void {
        if (this.#isShuttingDown || this.#flushTimer) {
            return;
        }

        this.#flushTimer = setTimeout(async () => {
            this.#flushTimer = null;
            await this.#flushAllBatches();

            if (!this.#isShuttingDown) {
                this.#scheduleFlush();
            }
        }, this.#flushInterval);
    }
}

export default TinybirdSyncBatchWorker;
