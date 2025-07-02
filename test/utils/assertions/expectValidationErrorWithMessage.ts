import {expect} from 'vitest';
import type {Response} from 'light-my-request';

export default function expectValidationErrorWithMessage(response: Response, message: string) {
    const bodyJson = JSON.parse(response.body);
    expect(response.statusCode).toBe(400);
    expect(bodyJson.error).toBe('Bad Request');
    expect(bodyJson.message).toBe(message);
}