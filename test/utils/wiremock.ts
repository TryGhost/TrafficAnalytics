interface WireMockStubMapping {
    id?: string;
    request: {
        method: string;
        url?: string;
        urlPattern?: string;
        headers?: Record<string, any>;
        bodyPatterns?: Array<{
            equalToJson?: any;
            matchesJsonPath?: string;
            contains?: string;
        }>;
    };
    response: {
        status: number;
        headers?: Record<string, string>;
        body?: string;
        jsonBody?: any;
    };
    priority?: number;
}

interface WireMockRequestLog {
    id: string;
    request: {
        url: string;
        absoluteUrl: string;
        method: string;
        clientIp: string;
        headers: Record<string, string>;
        body: string;
        loggedDate: number;
        loggedDateString: string;
    };
    responseDefinition: {
        status: number;
        body: string;
    };
    wasMatched: boolean;
}

export class WireMock {
    private baseUrl: string;

    constructor(baseUrl: string = 'http://localhost:8089') {
        this.baseUrl = baseUrl;
    }

    async setupStub(mapping: WireMockStubMapping): Promise<void> {
        const response = await fetch(`${this.baseUrl}/__admin/mappings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(mapping)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to setup WireMock stub: ${response.status} ${error}`);
        }
    }

    async resetAll(): Promise<void> {
        const response = await fetch(`${this.baseUrl}/__admin/reset`, {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error(`Failed to reset WireMock: ${response.status}`);
        }
    }

    async getRequestLogs(): Promise<WireMockRequestLog[]> {
        const response = await fetch(`${this.baseUrl}/__admin/requests`);
        
        if (!response.ok) {
            throw new Error(`Failed to get request logs: ${response.status}`);
        }

        const data = await response.json();
        return data.requests || [];
    }

    async findRequestsMatching(criteria: {
        method?: string;
        url?: string;
        urlPattern?: string;
        headers?: Record<string, string>;
    }): Promise<WireMockRequestLog[]> {
        const response = await fetch(`${this.baseUrl}/__admin/requests/find`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(criteria)
        });

        if (!response.ok) {
            throw new Error(`Failed to find requests: ${response.status}`);
        }

        const data = await response.json();
        return data.requests || [];
    }

    async waitForHealthy(timeoutMs: number = 30000): Promise<void> {
        const start = Date.now();
        
        while (Date.now() - start < timeoutMs) {
            try {
                const response = await fetch(`${this.baseUrl}/__admin/health`);
                if (response.ok) {
                    return;
                }
            } catch (error) {
                // Ignore connection errors and retry
            }
            
            await new Promise<void>((resolve) => {
                setTimeout(() => resolve(), 1000);
            });
        }
        
        throw new Error(`WireMock not ready after ${timeoutMs}ms`);
    }

    // Helper method to setup a simple stub for Tinybird analytics endpoint
    async setupTinybirdStub(options: {
        status?: number;
        responseBody?: string;
        responseHeaders?: Record<string, string>;
    } = {}): Promise<void> {
        const {
            status = 200,
            responseBody = 'OK',
            responseHeaders = {'Content-Type': 'text/plain'}
        } = options;

        await this.setupStub({
            request: {
                method: 'POST',
                urlPattern: '.*'
            },
            response: {
                status,
                body: responseBody,
                headers: responseHeaders
            },
            priority: 1
        });
    }

    // Helper method to verify that a request was made to Tinybird
    async verifyTinybirdRequest(expectedData?: {
        token?: string;
        name?: string;
        bodyContains?: string;
    }): Promise<WireMockRequestLog[]> {
        const criteria: any = {
            method: 'POST'
        };

        const requests = await this.findRequestsMatching(criteria);

        if (expectedData) {
            return requests.filter((request) => {
                let matches = true;

                if (expectedData.token && request.request?.url) {
                    matches = matches && request.request.url.includes(`token=${expectedData.token}`);
                }

                if (expectedData.name && request.request?.url) {
                    matches = matches && request.request.url.includes(`name=${expectedData.name}`);
                }

                if (expectedData.bodyContains && request.request?.body) {
                    matches = matches && request.request.body.includes(expectedData.bodyContains);
                }

                return matches;
            });
        }

        return requests;
    }

    // Helper method to get the parsed JSON body from a request
    parseRequestBody(request: WireMockRequestLog): any {
        try {
            return JSON.parse(request.request?.body || '{}');
        } catch (error) {
            return null;
        }
    }
}

export default WireMock;