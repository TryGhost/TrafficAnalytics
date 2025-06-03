import {ISaltStore} from '../salt-store';
import crypto from 'crypto';

export class UserSignatureService {
    private saltStore: ISaltStore;

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

    private generateRandomSalt(): string {
        return crypto.randomBytes(32).toString('hex');
    }

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

    async generateUserSignature(siteUuid: string, ipAddress: string, userAgent: string): Promise<string> {
        const salt = await this.getOrCreateSaltForSite(siteUuid);
        const timestamp = new Date().toISOString();
        const signature = `${salt}:${ipAddress}:${userAgent}:${timestamp}`;
        const hashedSignature = crypto.createHash('sha256').update(signature).digest('hex');
        return hashedSignature;
    }
};
