import {expect} from 'vitest';
import type {Response} from 'light-my-request';

export function expectUnsupportedMediaTypeErrorWithMessage(response: Response, message: string) {
    const bodyJson = JSON.parse(response.body);
    expect(response.statusCode).toBe(415);
    expect(bodyJson.error).toBe('Unsupported Media Type');
    expect(bodyJson.message).toBe(message);
}

export function expectValidationErrorWithMessage(response: Response, message: string) {
    const bodyJson = JSON.parse(response.body);
    expect(response.statusCode).toBe(400);
    expect(bodyJson.error).toBe('Bad Request');
    expect(bodyJson.message).toBe(message);
}