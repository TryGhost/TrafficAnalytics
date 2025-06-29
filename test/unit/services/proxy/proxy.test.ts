import {describe, it, expect} from 'vitest';
import {ensureValidEventId} from '../../../../src/plugins/proxy';

describe('Proxy Service', () => {
    describe('ensureValidEventId', () => {
        it('should return valid UUID unchanged', () => {
            const validUuid = '550e8400-e29b-41d4-a716-446655440000';
            const result = ensureValidEventId(validUuid);
            expect(result).toBe(validUuid);
        });

        it('should generate new UUID for invalid string', () => {
            const invalidEventId = 'not-a-uuid';
            const result = ensureValidEventId(invalidEventId);
            expect(result).not.toBe(invalidEventId);
            expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        });

        it('should generate new UUID for undefined', () => {
            const result = ensureValidEventId(undefined);
            expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        });

        it('should generate new UUID for empty string', () => {
            const result = ensureValidEventId('');
            expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        });

        it('should generate new UUID for null', () => {
            const result = ensureValidEventId(null as any);
            expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        });

        it('should handle various invalid UUID formats', () => {
            const invalidFormats = [
                'invalid-uuid',
                '123',
                'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
                '550e8400-e29b-41d4-a716', // too short
                '550e8400-e29b-41d4-a716-446655440000-extra' // too long
            ];

            invalidFormats.forEach((invalidFormat) => {
                const result = ensureValidEventId(invalidFormat);
                expect(result).not.toBe(invalidFormat);
                expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
            });
        });
    });
});