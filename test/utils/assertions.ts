import {expect} from 'vitest';
import type {Response} from 'light-my-request';

export function expectResponse({response, statusCode, errorType, message}: {response: Response, statusCode: number, errorType?: string, message?: string}) {
    const bodyJson = JSON.parse(response.body);
    expect(response.statusCode).toBe(statusCode);
    if (errorType) {
        expect(bodyJson.error).toBe(errorType);
    }
    if (message) {
        expect(bodyJson.message).toBe(message);
    }
}