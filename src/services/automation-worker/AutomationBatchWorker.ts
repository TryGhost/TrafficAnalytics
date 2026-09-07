import type {Message} from '@google-cloud/pubsub';
import {AutomationEventSchema, createValidator, type AutomationEvent} from '../../schemas';
import logger from '../../utils/logger';
import {EventSubscriber} from '../events/subscriber';
import {AUTOMATION_EVENT_DATASOURCES, AUTOMATION_EVENT_TYPES} from '../tinybird/automation';
import type {TinybirdClient, TinybirdEvent} from '../tinybird/client';

const validateAutomationEvent = createValidator(AutomationEventSchema);

export interface AutomationBatchWorkerConfig {
    batchSize?: number;
    flushInterval?: number;
}

export type AutomationTinybirdClients = Record<AutomationEvent['type'], Pick<TinybirdClient, 'postEventBatch'>>;

interface PendingMessage {
    message: Message;
    event: TinybirdEvent;
}

class AutomationBatchWorker {
    private subscriptionName: string;
    private subscriber: EventSubscriber;
    private tinybirdClients: AutomationTinybirdClients;
    private batches: Record<AutomationEvent['type'], PendingMessage[]>;
    private inFlight: Record<AutomationEvent['type'], Promise<void> | null>;
    private batchSize: number;
    private flushInterval: number;
    private flushTimer: NodeJS.Timeout | null;
    private isShuttingDown: boolean;

    constructor(subscriptionName: string, tinybirdClients: AutomationTinybirdClients, config: AutomationBatchWorkerConfig = {}) {
        logger.info({event: 'AutomationBatchWorkerCreating', subscriptionName});
        this.subscriptionName = subscriptionName;
        this.batchSize = config.batchSize || parseInt(process.env.AUTOMATION_BATCH_SIZE || '1000', 10);
        this.flushInterval = config.flushInterval || parseInt(process.env.AUTOMATION_BATCH_FLUSH_INTERVAL_MS || '1000', 10);
        // Bounds worker memory: one batch being posted plus one accumulating per type.
        this.subscriber = new EventSubscriber(subscriptionName, {
            flowControl: {
                maxMessages: this.batchSize * 2,
                allowExcessMessages: false
            }
        });
        this.tinybirdClients = tinybirdClients;
        this.batches = {
            automation_runs: [],
            automation_run_steps: []
        };
        this.inFlight = {
            automation_runs: null,
            automation_run_steps: null
        };
        this.flushTimer = null;
        this.isShuttingDown = false;

        logger.info({
            event: 'AutomationBatchWorkerConfigured',
            batchSize: this.batchSize,
            flushIntervalMs: this.flushInterval
        });
    }

    public start(): void {
        logger.info({event: 'AutomationBatchWorkerStarting', subscriptionName: this.subscriptionName});
        this.subscriber.subscribe(this.handleMessage.bind(this));
        this.scheduleFlush();
    }

    public async stop(): Promise<void> {
        logger.info({event: 'AutomationBatchWorkerStopping', subscriptionName: this.subscriptionName});
        this.isShuttingDown = true;

        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }

        await this.subscriber.close();
        await this.flushAllBatches();
    }

    private async handleMessage(message: Message): Promise<void> {
        const automationEvent = this.parseMessage(message);
        if (!automationEvent) {
            return;
        }

        try {
            const {type, ...event} = automationEvent;
            this.batches[type].push({message, event});

            logger.debug({
                event: 'AutomationWorkerQueuedEvent',
                messageId: message.id,
                automationEventId: automationEvent.id,
                automationEventType: type,
                batchSize: this.batches[type].length
            });

            if (this.batches[type].length >= this.batchSize) {
                await this.flushBatch(type);
            }
        } catch (err) {
            logger.error({
                event: 'AutomationWorkerMessageProcessingFailed',
                messageId: message.id,
                err
            });
            message.nack();
        }
    }

    private parseMessage(message: Message): AutomationEvent | null {
        try {
            return validateAutomationEvent(JSON.parse(message.data.toString()));
        } catch (err) {
            logger.error({
                event: 'AutomationWorkerMessageParsingFailed',
                messageId: message.id,
                err
            });
            message.ack();
            return null;
        }
    }

    // One Tinybird request per type at a time; a batch that fills while a request is
    // in flight is posted as soon as that request settles.
    private flushBatch(type: AutomationEvent['type']): Promise<void> {
        if (!this.inFlight[type]) {
            this.inFlight[type] = this.postBatch(type).finally(() => {
                this.inFlight[type] = null;
                if (this.batches[type].length >= this.batchSize) {
                    void this.flushBatch(type);
                }
            });
        }
        return this.inFlight[type];
    }

    private async postBatch(type: AutomationEvent['type']): Promise<void> {
        const batch = this.batches[type];
        if (batch.length === 0) {
            return;
        }

        this.batches[type] = [];

        try {
            await this.tinybirdClients[type].postEventBatch(batch.map(item => item.event));
            batch.forEach(item => item.message.ack());

            logger.info({
                event: 'AutomationWorkerFlushedBatch',
                automationEventType: type,
                datasource: AUTOMATION_EVENT_DATASOURCES[type],
                batchSize: batch.length,
                messageIds: batch.map(item => item.message.id)
            });
        } catch (err) {
            logger.error({
                event: 'AutomationWorkerBatchFlushFailed',
                automationEventType: type,
                datasource: AUTOMATION_EVENT_DATASOURCES[type],
                batchSize: batch.length,
                messageIds: batch.map(item => item.message.id),
                err
            });
            batch.forEach(item => item.message.nack());
        }
    }

    private async flushAllBatches(): Promise<void> {
        await Promise.all(AUTOMATION_EVENT_TYPES.map(type => this.flushBatch(type)));
    }

    private scheduleFlush(): void {
        if (this.isShuttingDown || this.flushTimer) {
            return;
        }

        this.flushTimer = setTimeout(async () => {
            this.flushTimer = null;
            await this.flushAllBatches();

            if (!this.isShuttingDown) {
                this.scheduleFlush();
            }
        }, this.flushInterval);
    }
}

export default AutomationBatchWorker;
