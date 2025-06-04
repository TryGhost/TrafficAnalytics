import {describe, it, expect, beforeEach, vi} from 'vitest';
import {UserSignatureService} from '../../../../src/services/user-signature';
import {MemorySaltStore} from '../../../../src/services/salt-store/MemorySaltStore';
import type {ISaltStore} from '../../../../src/services/salt-store';
import crypto from 'crypto';

describe('UserSignatureService', () => {
    let userSignatureService: UserSignatureService;
    let mockSaltStore: ISaltStore;

    beforeEach(() => {
        mockSaltStore = new MemorySaltStore();
        userSignatureService = new UserSignatureService(mockSaltStore);
    });

    describe('constructor', () => {
        it('should create an instance with provided salt store', () => {
            const service = new UserSignatureService(mockSaltStore);
            expect(service).toBeInstanceOf(UserSignatureService);
        });
    });

    describe('generateUserSignature', () => {
        const testSiteUuid = '550e8400-e29b-41d4-a716-446655440000';
        const testIp = '192.168.1.1';
        const testUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';

        it('should generate user signature and auto-create salt if not exists', async () => {
            vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-01T12:00:00.000Z');

            const signature = await userSignatureService.generateUserSignature(testSiteUuid, testIp, testUserAgent);

            expect(signature).toBeDefined();
            expect(typeof signature).toBe('string');
            expect(signature).toHaveLength(64);
            expect(/^[a-f0-9]+$/i.test(signature)).toBe(true);
        });

        it('should generate consistent signature for same inputs on same day', async () => {
            vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-01T12:00:00.000Z');

            const signature1 = await userSignatureService.generateUserSignature(testSiteUuid, testIp, testUserAgent);
            const signature2 = await userSignatureService.generateUserSignature(testSiteUuid, testIp, testUserAgent);

            expect(signature1).toBe(signature2);
        });

        it('should generate different signatures for different IPs', async () => {
            const signature1 = await userSignatureService.generateUserSignature(testSiteUuid, '192.168.1.1', testUserAgent);
            const signature2 = await userSignatureService.generateUserSignature(testSiteUuid, '192.168.1.2', testUserAgent);

            expect(signature1).not.toBe(signature2);
        });

        it('should generate different signatures for different user agents', async () => {
            const signature1 = await userSignatureService.generateUserSignature(testSiteUuid, testIp, 'Chrome/91.0');
            const signature2 = await userSignatureService.generateUserSignature(testSiteUuid, testIp, 'Firefox/89.0');

            expect(signature1).not.toBe(signature2);
        });

        it('should generate different signatures for different site UUIDs', async () => {
            const signature1 = await userSignatureService.generateUserSignature('6ba7b810-9dad-11d1-80b4-00c04fd430c8', testIp, testUserAgent);
            const signature2 = await userSignatureService.generateUserSignature('6ba7b811-9dad-11d1-80b4-00c04fd430c8', testIp, testUserAgent);

            expect(signature1).not.toBe(signature2);
        });

        it('should handle undefined user agent', async () => {
            const signature = await userSignatureService.generateUserSignature(testSiteUuid, testIp, undefined as unknown as string);
            expect(signature).toBeDefined();
            expect(typeof signature).toBe('string');
        });

        it('should generate same signatures for different timestamps on same day', async () => {
            const timeStub = vi.spyOn(Date.prototype, 'toISOString');

            timeStub.mockReturnValue('2024-01-01T12:00:00.000Z');
            const signature1 = await userSignatureService.generateUserSignature(testSiteUuid, testIp, testUserAgent);

            timeStub.mockReturnValue('2024-01-01T12:00:01.000Z');
            const signature2 = await userSignatureService.generateUserSignature(testSiteUuid, testIp, testUserAgent);

            expect(signature1).toBe(signature2);
        });

        it('should generate different signatures for different days (UTC)', async () => {
            const timeStub = vi.spyOn(Date.prototype, 'toISOString');

            timeStub.mockReturnValue('2024-01-01T23:59:59.999Z');
            const signature1 = await userSignatureService.generateUserSignature(testSiteUuid, testIp, testUserAgent);

            timeStub.mockReturnValue('2024-01-02T00:00:00.000Z');
            const signature2 = await userSignatureService.generateUserSignature(testSiteUuid, testIp, testUserAgent);

            expect(signature1).not.toBe(signature2);
        });

        it('should verify correct signature format', async () => {
            const mockDate = '2024-01-01T12:00:00.000Z';
            vi.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockDate);

            const salt = await (userSignatureService as any).getOrCreateSaltForSite(testSiteUuid);

            const signature = await userSignatureService.generateUserSignature(testSiteUuid, testIp, testUserAgent);

            const expectedInput = `${salt}:${testSiteUuid}:${testIp}:${testUserAgent}`;
            const expectedHash = crypto.createHash('sha256').update(expectedInput).digest('hex');
            expect(signature).toBe(expectedHash);
        });
    });

    describe('integration with different salt stores', () => {
        it('should work with different salt store implementations', async () => {
            const customSaltStore: ISaltStore = {
                async get(key: string) {
                    return {salt: `custom-salt-for-${key}`, created_at: new Date()};
                },
                async set(key: string, salt: string) {
                    return {salt, created_at: new Date()};
                },
                async getAll() {
                    return {};
                },
                async delete() {},
                clear: () => Promise.resolve()
            };

            const service = new UserSignatureService(customSaltStore);
            const signature = await service.generateUserSignature('123e4567-e89b-12d3-a456-426614174000', '127.0.0.1', 'Test Agent');

            expect(signature).toBeDefined();
            expect(typeof signature).toBe('string');
        });
    });

    describe('private methods testing via reflection', () => {
        it('should generate random salt of correct length', () => {
            const salt1 = (userSignatureService as any).generateRandomSalt();
            const salt2 = (userSignatureService as any).generateRandomSalt();

            expect(typeof salt1).toBe('string');
            expect(salt1).toHaveLength(64);
            expect(salt1).not.toBe(salt2);
            expect(/^[a-f0-9]+$/i.test(salt1)).toBe(true);
        });

        it('should generate key with date and site UUID', () => {
            vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-01T12:00:00.000Z');

            const key = (userSignatureService as any).getKey('550e8400-e29b-41d4-a716-446655440000');

            expect(key).toBe('salt:2024-01-01:550e8400-e29b-41d4-a716-446655440000');
        });

        it('should create and return new salt when salt does not exist', async () => {
            const result = await (userSignatureService as any).getOrCreateSaltForSite('987fcdeb-51d2-43e1-9b45-123456789abc');

            expect(typeof result).toBe('string');
            expect(result).toHaveLength(64);
            expect(/^[a-f0-9]+$/i.test(result)).toBe(true);
        });

        it('should return existing salt when it exists', async () => {
            vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-01T12:00:00.000Z');

            const existingSiteUuid = '123e4567-e89b-12d3-a456-426614174000';
            const expectedKey = `salt:2024-01-01:${existingSiteUuid}`;
            const testSalt = 'existing-salt';
            await mockSaltStore.set(expectedKey, testSalt);

            const result = await (userSignatureService as any).getOrCreateSaltForSite(existingSiteUuid);

            expect(result).toBe(testSalt);
        });
    });
});
