import {PubSub, Subscription, Message} from '@google-cloud/pubsub';
import type {FastifyBaseLogger} from 'fastify';

export interface SubscriberOptions {
    projectId: string;
    subscriptionName: string;
    topicName: string;
    logger: FastifyBaseLogger;
}

export class EventSubscriber {
    private subscription: Subscription | null = null;
    private logger: FastifyBaseLogger | null = null;
    private isShuttingDown = false;

    async start(options: SubscriberOptions): Promise<void> {
        this.logger = options.logger;
        
        const pubsub = new PubSub({projectId: options.projectId});
        this.subscription = pubsub.subscription(options.subscriptionName);
        
        // Set up pull subscription message handler
        this.subscription.on('message', (message: Message) => {
            this.handleMessage(message);
        });
        
        // Set up error handler
        this.subscription.on('error', (error: Error) => {
            this.handleError(error);
        });
        
        this.logger.info({
            projectId: options.projectId,
            subscriptionName: options.subscriptionName,
            topicName: options.topicName
        }, 'Started pull subscription');
    }
    
    private handleMessage(message: Message): void {
        if (this.isShuttingDown) {
            message.nack();
            return;
        }

        try {
            const messageData = message.data.toString();
            const publishTime = message.publishTime;
            
            // Parse the event data
            let eventData: Record<string, unknown>;
            try {
                eventData = JSON.parse(messageData);
            } catch (parseError) {
                this.logger?.error({
                    messageId: message.id,
                    error: parseError instanceof Error ? parseError.message : String(parseError),
                    rawData: messageData
                }, 'Failed to parse message data');
                message.nack();
                return;
            }
            
            // Log the received event with structured logging
            this.logger?.info({
                messageId: message.id,
                publishTime: publishTime ? publishTime.toISOString() : null,
                eventData,
                payloadSize: message.data.length
            }, 'Received page-hits-raw event');
            
            // Acknowledge the message after successful processing
            message.ack();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger?.error({
                messageId: message.id,
                error: errorMessage
            }, 'Failed to process message');
            
            // Nack the message for retry
            message.nack();
        }
    }
    
    private handleError(error: Error): void {
        this.logger?.error({
            error: error.message,
            stack: error.stack
        }, 'Pub/Sub subscription error');
    }
    
    async stop(): Promise<void> {
        this.isShuttingDown = true;
        
        if (this.subscription) {
            this.logger?.info('Stopping Pub/Sub subscription...');
            
            try {
                await this.subscription.close();
                this.subscription = null;
                this.logger?.info('Pub/Sub subscription stopped successfully');
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger?.error({
                    error: errorMessage
                }, 'Error stopping Pub/Sub subscription');
                throw error;
            }
        }
    }
}