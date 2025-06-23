export interface TinybirdEvent {
    [key: string]: unknown;
}

export interface TinybirdClientConfig {
    apiUrl: string;
    apiToken: string;
    datasource: string;
}

export class TinybirdClient {
    private config: TinybirdClientConfig;

    constructor(config: TinybirdClientConfig) {
        this.config = config;
    }

    async postEvent(event: TinybirdEvent): Promise<void> {
        const url = `${this.config.apiUrl}/v0/events?name=${encodeURIComponent(this.config.datasource)}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.config.apiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(event)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Tinybird API error: ${response.status} ${response.statusText} - ${errorText}`);
        }
    }
}