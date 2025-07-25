import {describe, it, expect, beforeEach, vi, afterEach} from 'vitest';
import {UserSignatureService} from '../../../../src/services/user-signature';
import {MemorySaltStore} from '../../../../src/services/salt-store/MemorySaltStore';
import type {ISaltStore} from '../../../../src/services/salt-store';
import crypto from 'crypto';
import logger from '../../../../src/utils/logger';

describe('UserSignatureService', () => {
    let userSignatureService: UserSignatureService;
    let mockSaltStore: ISaltStore;

    beforeEach(() => {
        vi.clearAllMocks();
        // Mock logger methods to avoid noise in tests
        vi.spyOn(logger, 'info').mockImplementation(() => {});
        vi.spyOn(logger, 'error').mockImplementation(() => {});
        
        mockSaltStore = new MemorySaltStore();
        userSignatureService = new UserSignatureService(mockSaltStore);
    });

    afterEach(() => {
        // Clean up any running schedulers
        userSignatureService.stopCleanupScheduler();
        vi.clearAllMocks();
        vi.clearAllTimers();
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
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                async getOrCreate(key: string, saltGenerator: () => string) {
                    return {salt: `custom-salt-for-${key}`, created_at: new Date()};
                },
                async getAll() {
                    return {};
                },
                async delete() {},
                clear: () => Promise.resolve(),
                cleanup: () => Promise.resolve(0)
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

    describe('cleanup scheduler', () => {
        describe('environment variable controls', () => {
            it('should not start scheduler when NODE_ENV is testing', () => {
                const originalEnv = process.env.NODE_ENV;
                process.env.NODE_ENV = 'testing';
                
                const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
                const service = new UserSignatureService(mockSaltStore);
                
                expect(setTimeoutSpy).not.toHaveBeenCalled();
                
                service.stopCleanupScheduler();
                process.env.NODE_ENV = originalEnv;
            });

            it('should not start scheduler when ENABLE_SALT_CLEANUP_SCHEDULER is false', () => {
                vi.stubEnv('ENABLE_SALT_CLEANUP_SCHEDULER', 'false');
                
                const originalNodeEnv = process.env.NODE_ENV;
                process.env.NODE_ENV = 'production';
                
                const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
                const service = new UserSignatureService(mockSaltStore);
                
                expect(setTimeoutSpy).not.toHaveBeenCalled();
                
                service.stopCleanupScheduler();
                process.env.NODE_ENV = originalNodeEnv;
            });

            it('should start scheduler when environment allows', () => {
                vi.stubEnv('ENABLE_SALT_CLEANUP_SCHEDULER', 'true');
                vi.stubEnv('NODE_ENV', 'production');
                
                const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
                const service = new UserSignatureService(mockSaltStore);
                
                expect(setTimeoutSpy).toHaveBeenCalledOnce();
                expect(setTimeoutSpy).toHaveBeenCalledWith(
                    expect.any(Function),
                    expect.any(Number) // Random delay between 0-60 minutes
                );
                
                const delayMs = setTimeoutSpy.mock.calls[0][1] as number;
                expect(delayMs).toBeGreaterThanOrEqual(0);
                expect(delayMs).toBeLessThan(60 * 60 * 1000); // Less than 60 minutes
                
                service.stopCleanupScheduler();
            });
        });

        describe('scheduler lifecycle', () => {
            it('should stop cleanup scheduler', () => {
                vi.stubEnv('NODE_ENV', 'production');
                const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
                const service = new UserSignatureService(mockSaltStore);
                
                // Simulate that the interval was set
                (service as any).cleanupInterval = 123;
                
                service.stopCleanupScheduler();
                
                expect(clearIntervalSpy).toHaveBeenCalledWith(123);
                expect((service as any).cleanupInterval).toBeNull();
            });

            it('should handle stopping scheduler when no interval is set', () => {
                const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
                
                userSignatureService.stopCleanupScheduler();
                
                expect(clearIntervalSpy).not.toHaveBeenCalled();
            });
        });

        describe('cleanup execution', () => {
            it('should execute cleanup and log success', async () => {
                vi.stubEnv('NODE_ENV', 'production');
                // Set up spies before creating service
                const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
                const cleanupSpy = vi.spyOn(mockSaltStore, 'cleanup').mockResolvedValue(5);
                const loggerInfoSpy = vi.spyOn(logger, 'info');
                
                // Create service - this will call setTimeout
                const service = new UserSignatureService(mockSaltStore);
                
                expect(setTimeoutSpy).toHaveBeenCalledOnce();
                
                // Get the cleanup function from setTimeout call
                const timeoutCallback = setTimeoutSpy.mock.calls[0][0] as () => Promise<void>;
                
                // Execute the cleanup
                await timeoutCallback();
                
                expect(cleanupSpy).toHaveBeenCalledOnce();
                expect(loggerInfoSpy).toHaveBeenCalledWith('Salt cleanup completed: 5 old salts deleted');
                
                service.stopCleanupScheduler();
            });

            it('should handle cleanup errors gracefully', async () => {
                vi.stubEnv('NODE_ENV', 'production');
                // Set up spies before creating service
                const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
                const error = new Error('Cleanup failed');
                const cleanupSpy = vi.spyOn(mockSaltStore, 'cleanup').mockRejectedValue(error);
                const loggerErrorSpy = vi.spyOn(logger, 'error');
                
                const service = new UserSignatureService(mockSaltStore);
                
                // Get and execute the cleanup function
                const timeoutCallback = setTimeoutSpy.mock.calls[0][0] as () => Promise<void>;
                
                await timeoutCallback();
                
                expect(cleanupSpy).toHaveBeenCalledOnce();
                expect(loggerErrorSpy).toHaveBeenCalledWith('Salt cleanup failed:', error);
                
                service.stopCleanupScheduler();
            });

            it('should set up recurring cleanup after initial run', async () => {
                vi.stubEnv('NODE_ENV', 'production');
                // Set up spies before creating service
                const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
                const setIntervalSpy = vi.spyOn(global, 'setInterval');
                vi.spyOn(mockSaltStore, 'cleanup').mockResolvedValue(0);
                
                const service = new UserSignatureService(mockSaltStore);
                
                // Get and execute the initial cleanup function
                const timeoutCallback = setTimeoutSpy.mock.calls[0][0] as () => Promise<void>;
                
                await timeoutCallback();
                
                // Should set up recurring cleanup
                expect(setIntervalSpy).toHaveBeenCalledOnce();
                expect(setIntervalSpy).toHaveBeenCalledWith(
                    expect.any(Function),
                    24 * 60 * 60 * 1000 // 24 hours
                );
                
                service.stopCleanupScheduler();
            });
        });

        describe('random delay', () => {
            it('should use different random delays for multiple instances', () => {
                vi.stubEnv('NODE_ENV', 'production');
                const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
                
                // Create multiple services
                const service1 = new UserSignatureService(new MemorySaltStore());
                const service2 = new UserSignatureService(new MemorySaltStore());
                
                expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
                
                const delay1 = setTimeoutSpy.mock.calls[0][1] as number;
                const delay2 = setTimeoutSpy.mock.calls[1][1] as number;
                
                // Both delays should be in valid range
                expect(delay1).toBeGreaterThanOrEqual(0);
                expect(delay1).toBeLessThan(60 * 60 * 1000);
                expect(delay2).toBeGreaterThanOrEqual(0);
                expect(delay2).toBeLessThan(60 * 60 * 1000);
                
                service1.stopCleanupScheduler();
                service2.stopCleanupScheduler();
            });
        });

        describe('race condition scenarios', () => {
            it('should handle race condition when multiple processes create same salt', async () => {
                vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-01T12:00:00.000Z');
                
                const testSiteUuid = '550e8400-e29b-41d4-a716-446655440000';
                
                let createdSalt: string | null = null;
                const raceSaltStore: ISaltStore = {
                    async get() {
                        // Return the salt if it was created
                        if (createdSalt) {
                            return {salt: createdSalt, created_at: new Date()};
                        }
                        return undefined;
                    },
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    async set(saltKey: string, salt: string) {
                        // This shouldn't be called anymore since we use getOrCreate
                        throw new Error('set() should not be called when using getOrCreate');
                    },
                    async getOrCreate(key: string, saltGenerator: () => string) {
                        // Simulate race condition handling - first call wins
                        if (createdSalt) {
                            return {salt: createdSalt, created_at: new Date()};
                        }
                        
                        // Create the salt atomically
                        createdSalt = saltGenerator();
                        return {salt: createdSalt, created_at: new Date()};
                    },
                    async getAll() {
                        return {};
                    },
                    async delete() {},
                    clear: () => Promise.resolve(),
                    cleanup: () => Promise.resolve(0)
                };

                const service = new UserSignatureService(raceSaltStore);
                
                // Both calls should succeed - one creates the salt, the other should retry and get it
                const promise1 = (service as any).getOrCreateSaltForSite(testSiteUuid);
                const promise2 = (service as any).getOrCreateSaltForSite(testSiteUuid);
                
                const results = await Promise.allSettled([promise1, promise2]);
                
                // Both should succeed (this will fail with current implementation)
                expect(results[0].status).toBe('fulfilled');
                expect(results[1].status).toBe('fulfilled');
                
                // Both should return the same salt value
                if (results[0].status === 'fulfilled' && results[1].status === 'fulfilled') {
                    expect(results[0].value).toBe(results[1].value);
                }
                
                service.stopCleanupScheduler();
            });
        });
    });
});
