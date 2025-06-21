import {describe, it, expect, beforeEach, vi} from 'vitest';
import {TinybirdClient} from '../../../../src/services/tinybird/client';

// Mock fetch globally
global.fetch = vi.fn();

describe('TinybirdClient', () => {
    let client: TinybirdClient;
    const mockConfig = {
        apiUrl: 'https://api.tinybird.co',
        apiToken: 'test-token',
        datasource: 'test_datasource'
    };

    beforeEach(() => {
        client = new TinybirdClient(mockConfig);
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create a client with the provided config', () => {
            expect(client).toBeInstanceOf(TinybirdClient);
        });
    });

    describe('postEvent', () => {
        it('should make a POST request to the correct URL with proper headers', async () => {
            const mockEvent = {
                timestamp: '2024-01-15T12:00:00Z',
                event_type: 'page_view',
                user_id: 'user123'
            };

            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK'
            };

            (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

            await client.postEvent(mockEvent);

            expect(fetch).toHaveBeenCalledWith(
                'https://api.tinybird.co/v0/events?name=test_datasource',
                {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer test-token',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(mockEvent)
                }
            );
        });

        it('should URL encode the datasource name', async () => {
            const clientWithSpecialChars = new TinybirdClient({
                ...mockConfig,
                datasource: 'test datasource with spaces & symbols'
            });

            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK'
            };

            (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

            await clientWithSpecialChars.postEvent({test: 'data'});

            expect(fetch).toHaveBeenCalledWith(
                'https://api.tinybird.co/v0/events?name=test%20datasource%20with%20spaces%20%26%20symbols',
                expect.objectContaining({
                    method: 'POST'
                })
            );
        });

        it('should handle successful responses', async () => {
            const mockEvent = {data: 'test'};
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK'
            };

            (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

            await expect(client.postEvent(mockEvent)).resolves.not.toThrow();
        });

        it('should throw an error for non-ok responses', async () => {
            const mockEvent = {data: 'test'};
            const errorMessage = 'Invalid request format';
            const mockResponse = {
                ok: false,
                status: 400,
                statusText: 'Bad Request',
                text: vi.fn().mockResolvedValue(errorMessage)
            };

            (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

            await expect(client.postEvent(mockEvent)).rejects.toThrow(
                'Tinybird API error: 400 Bad Request - Invalid request format'
            );
        });

        it('should handle network errors', async () => {
            const mockEvent = {data: 'test'};
            const networkError = new Error('Network error');

            (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(networkError);

            await expect(client.postEvent(mockEvent)).rejects.toThrow('Network error');
        });

        it('should handle empty event objects', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK'
            };

            (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

            await expect(client.postEvent({})).resolves.not.toThrow();

            expect(fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    body: JSON.stringify({})
                })
            );
        });

        it('should handle complex event objects', async () => {
            const complexEvent = {
                timestamp: '2024-01-15T12:00:00Z',
                user: {
                    id: 'user123',
                    properties: {
                        name: 'John Doe',
                        email: 'john@example.com'
                    }
                },
                event_data: {
                    page: '/home',
                    referrer: 'https://google.com',
                    metrics: [1, 2, 3]
                },
                metadata: null
            };

            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK'
            };

            (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

            await expect(client.postEvent(complexEvent)).resolves.not.toThrow();

            expect(fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    body: JSON.stringify(complexEvent)
                })
            );
        });

        it('should handle server errors with detailed error messages', async () => {
            const mockEvent = {data: 'test'};
            const detailedError = JSON.stringify({
                error: 'validation_failed',
                message: 'Required field missing: timestamp',
                details: {
                    field: 'timestamp',
                    reason: 'missing'
                }
            });

            const mockResponse = {
                ok: false,
                status: 422,
                statusText: 'Unprocessable Entity',
                text: vi.fn().mockResolvedValue(detailedError)
            };

            (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

            const error = await client.postEvent(mockEvent).catch(e => e);
            expect(error.message).toContain('Tinybird API error: 422 Unprocessable Entity');
            expect(error.message).toContain(detailedError);
        });
    });

    describe('integration scenarios', () => {
        it('should work with different API URLs', async () => {
            const customClient = new TinybirdClient({
                apiUrl: 'https://custom.tinybird.instance.com',
                apiToken: 'custom-token',
                datasource: 'custom_events'
            });

            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK'
            };

            (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

            await customClient.postEvent({test: 'data'});

            expect(fetch).toHaveBeenCalledWith(
                'https://custom.tinybird.instance.com/v0/events?name=custom_events',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer custom-token'
                    })
                })
            );
        });

        it('should handle multiple rapid requests', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK'
            };

            (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

            const events = [
                {id: 1, type: 'click'},
                {id: 2, type: 'view'},
                {id: 3, type: 'scroll'}
            ];

            const promises = events.map(event => client.postEvent(event));
            await expect(Promise.all(promises)).resolves.not.toThrow();

            expect(fetch).toHaveBeenCalledTimes(3);
        });
    });
});