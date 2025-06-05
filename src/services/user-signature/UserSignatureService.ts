import {ISaltStore} from '../salt-store';
import crypto from 'crypto';

/**
 * Service for generating privacy-preserving user signatures.
 *
 * Creates unique, non-reversible identifiers for users based on their IP address,
 * user agent, and a daily-rotating salt. This allows for analytics without storing
 * personally identifiable information.
 */
export class UserSignatureService {
    private saltStore: ISaltStore;
    private cleanupInterval: NodeJS.Timeout | null = null;

    /**
     * Creates a new UserSignatureService instance.
     *
     * @param saltStore - The salt store implementation used to persist and retrieve salts
     */
    constructor(saltStore: ISaltStore) {
        // eslint-disable-next-line no-console
        console.log('UserSignatureService constructor');
        this.saltStore = saltStore;
        this.startCleanupScheduler();
    }

    /**
     * Start the salt cleanup scheduler
     */
    private startCleanupScheduler() {
        // Only start scheduler in production (not during testing)
        if (process.env.NODE_ENV === 'testing' || process.env.ENABLE_SALT_CLEANUP_SCHEDULER === 'false') {
            return;
        }

        const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        
        const runCleanup = async () => {
            try {
                const deletedCount = await this.saltStore.cleanup();
                // eslint-disable-next-line no-console
                console.log(`Salt cleanup completed: ${deletedCount} old salts deleted`);
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Salt cleanup failed:', error);
            }
        };
        
        // Add random delay (0-60 minutes) to prevent multiple instances from running simultaneously
        const randomDelayMinutes = Math.floor(Math.random() * 60);
        const randomDelayMs = randomDelayMinutes * 60 * 1000;
        
        // eslint-disable-next-line no-console
        console.log(`Salt cleanup scheduler will start in ${randomDelayMinutes} minutes`);
        
        // Schedule first cleanup with random delay
        setTimeout(async () => {
            await runCleanup();
            
            // Schedule subsequent cleanups every 24 hours
            this.cleanupInterval = setInterval(runCleanup, CLEANUP_INTERVAL);
        }, randomDelayMs);
    }

    /**
     * Stop the salt cleanup scheduler (useful for testing or graceful shutdown)
     */
    public stopCleanupScheduler() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    /**
     * The salt store is keyed by the date and site_uuid.
     * This allows us to passively rotate the salt for all sites daily.
     * @param siteUuid - The site_uuid to get the salt for
     * @returns The key to use to store the salt for the site
     */
    private getKey(siteUuid: string): string {
        const date = new Date().toISOString().split('T')[0];
        return `salt:${date}:${siteUuid}`;
    }

    /**
     * Generates a cryptographically secure random salt.
     *
     * @returns A 64-character hexadecimal string (256 bits of entropy)
     */
    private generateRandomSalt(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Retrieves an existing salt for a site or creates a new one if none exists.
     *
     * Uses the current date and site UUID to generate a unique key. This ensures
     * salts are automatically rotated daily for each site.
     *
     * @param siteUuid - The unique identifier of the site
     * @returns The salt for the site and current date
     */
    private async getOrCreateSaltForSite(siteUuid: string): Promise<string> {
        const key = this.getKey(siteUuid);
        const salt = await this.saltStore.get(key);
        if (!salt) {
            const newSalt = this.generateRandomSalt();
            await this.saltStore.set(key, newSalt);
            return newSalt;
        }
        return salt.salt;
    }

    /**
     * Generates a unique, privacy-preserving signature for a user.
     *
     * Creates a SHA-256 hash of the combination of:
     * - Daily-rotating salt (specific to the site)
     * - Site UUID
     * - User's IP address
     * - User agent string
     *
     * The resulting hash is non-reversible, ensuring user privacy while still
     * allowing for unique user identification within analytics. The same user
     * making multiple requests on the same day will have the same signature.
     *
     * @param siteUuid - The unique identifier of the site
     * @param ipAddress - The user's IP address
     * @param userAgent - The user's browser user agent string
     * @returns A 64-character hexadecimal SHA-256 hash representing the user signature
     */
    async generateUserSignature(siteUuid: string, ipAddress: string, userAgent: string): Promise<string> {
        const salt = await this.getOrCreateSaltForSite(siteUuid);
        const signature = `${salt}:${siteUuid}:${ipAddress}:${userAgent}`;
        const hashedSignature = crypto.createHash('sha256').update(signature).digest('hex');
        return hashedSignature;
    }
};
