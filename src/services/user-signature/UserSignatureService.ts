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

    /**
     * Creates a new UserSignatureService instance.
     *
     * @param saltStore - The salt store implementation used to persist and retrieve salts
     */
    constructor(saltStore: ISaltStore) {
        this.saltStore = saltStore;
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
