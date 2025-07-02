import {expect} from 'vitest';
import type {Response} from 'light-my-request';

export default function expectUnsupportedMediaTypeErrorWithMessage(response: Response, message: string) {
    const bodyJson = JSON.parse(response.body);
    expect(response.statusCode).toBe(415);
    expect(bodyJson.error).toBe('Unsupported Media Type');
    expect(bodyJson.message).toBe(message);
}