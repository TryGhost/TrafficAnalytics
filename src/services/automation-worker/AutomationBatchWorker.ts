import type {Message} from '@google-cloud/pubsub';
import {z} from 'zod';
import {AutomationEventSchema, createValidator, type AutomationEvent} from '../../schemas';
import logger from '../../utils/logger';
import {EventSubscriber} from '../events/subscriber';
import {AUTOMATION_EVENT_DATASOURCES, AUTOMATION_EVENT_TYPES} from '../tinybird/automation';
import type {TinybirdClient, TinybirdEvent} from '../tinybird/client';

// Rows are validated one at a time below so a bad row is dropped rather than the
// whole chunk; the envelope only needs to be the right shape.
const ChunkEnvelopeSchema = z.strictObject({
    type: z.enum(AUTOMATION_EVENT_TYPES),
    events: z.array(z.unknown()).min(1)
});

const validateChunkEnvelope = createValidator(ChunkEnvelopeSchema);
const validateAutomationEvent = createValidator(AutomationEventSchema);

export interface AutomationBatchWorkerConfig {
    concurrency?: number;
}

export type AutomationTinybirdClients = Record<AutomationEvent['type'], Pick<TinybirdClient, 'postEventBatch'>>;

class AutomationBatchWorker {
    private subscriptionName: string;
    private subscriber: EventSubscriber;
    private tinybirdClients: AutomationTinybirdClients;

    constructor(subscriptionName: string, tinybirdClients: AutomationTinybirdClients, config: AutomationBatchWorkerConfig = {}) {
        logger.info({event: 'AutomationBatchWorkerCreating', subscriptionName});
        this.subscriptionName = subscriptionName;
        this.tinybirdClients = tinybirdClients;

        // Each message is one chunk that becomes one Tinybird request, so outstanding
        // messages is the number of Tinybird requests in flight.
        const concurrency = config.concurrency || parseInt(process.env.AUTOMATION_WORKER_CONCURRENCY || '4', 10);
        this.subscriber = new EventSubscriber(subscriptionName, {
            flowControl: {
                maxMessages: concurrency,
                allowExcessMessages: false
            }
        });

        logger.info({event: 'AutomationBatchWorkerConfigured', concurrency});
    }

    public start(): void {
        logger.info({event: 'AutomationBatchWorkerStarting', subscriptionName: this.subscriptionName});
        this.subscriber.subscribe(this.handleMessage.bind(this));
    }

    public async stop(): Promise<void> {
        logger.info({event: 'AutomationBatchWorkerStopping', subscriptionName: this.subscriptionName});
        await this.subscriber.close();
    }

    private async handleMessage(message: Message): Promise<void> {
        const chunk = this.parseChunk(message);
        if (!chunk) {
            return;
        }

        const {type, events} = chunk;
        if (events.length === 0) {
            message.ack();
            return;
        }

        try {
            await this.tinybirdClients[type].postEventBatch(events);
            message.ack();
            logger.info({
                event: 'AutomationWorkerPostedChunk',
                messageId: message.id,
                automationEventType: type,
                datasource: AUTOMATION_EVENT_DATASOURCES[type],
                eventCount: events.length
            });
        } catch (err) {
            logger.error({
                event: 'AutomationWorkerChunkPostFailed',
                messageId: message.id,
                automationEventType: type,
                datasource: AUTOMATION_EVENT_DATASOURCES[type],
                eventCount: events.length,
                err
            });
            message.nack();
        }
    }

    private parseChunk(message: Message): {type: AutomationEvent['type']; events: TinybirdEvent[]} | null {
        let envelope;
        try {
            envelope = validateChunkEnvelope(JSON.parse(message.data.toString()));
        } catch (err) {
            logger.error({
                event: 'AutomationWorkerMessageParsingFailed',
                messageId: message.id,
                err
            });
            // A malformed message will not parse next time either.
            message.ack();
            return null;
        }

        const events: TinybirdEvent[] = [];
        for (const candidate of envelope.events) {
            try {
                const {type, ...event} = validateAutomationEvent({type: envelope.type, ...(candidate as object)});
                void type;
                events.push(event);
            } catch (err) {
                logger.error({
                    event: 'AutomationWorkerEventDropped',
                    messageId: message.id,
                    automationEventType: envelope.type,
                    err
                });
            }
        }

        return {type: envelope.type, events};
    }
}

export default AutomationBatchWorker;
