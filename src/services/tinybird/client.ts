import logger from '../../utils/logger';

export interface TinybirdEvent {
    [key: string]: unknown;
}

export interface TinybirdClientConfig {
    apiUrl: string;
    apiToken: string;
    datasource: string;
}

export class TinybirdClient {
    private apiUrl: string;
    private apiToken: string;
    private datasource: string;

    constructor(config: TinybirdClientConfig) {
        if (!config.apiUrl || !config.apiToken || !config.datasource) {
            throw new Error('TinybirdClient constructor requires apiUrl, apiToken, and datasource');
        }
        // Remove /v0/events from the apiUrl if it exists
        this.apiUrl = config.apiUrl.replace(/\/v0\/events$/, '');
        this.apiToken = config.apiToken;
        this.datasource = config.datasource;
        logger.info({apiUrl: this.apiUrl, datasource: this.datasource}, 'TinybirdClient constructor');
    }

    async postEvent(event: TinybirdEvent): Promise<void> {
        const url = `${this.apiUrl}/v0/events?name=${encodeURIComponent(this.datasource)}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(event)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Tinybird API error: ${response.status} ${response.statusText} - ${errorText}`);
        }
    }

    async postEventBatch(events: TinybirdEvent[]): Promise<void> {
        if (events.length === 0) {
            return;
        }

        const url = `${this.apiUrl}/v0/events?name=${encodeURIComponent(this.datasource)}`;
        
        // Convert events to newline-delimited JSON format for batch insertion
        const batchPayload = events.map(event => JSON.stringify(event)).join('\n');
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json'
            },
            body: batchPayload
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Tinybird batch API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        logger.info(`Successfully posted batch of ${events.length} events to Tinybird`);
    }
}