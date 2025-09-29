import crypto from 'crypto';
import {FastifyRequest} from 'fastify';

export interface HmacValidationResult {
    isValid: boolean;
    cleanedUrl: string;
    originalUrl: string;
    timestampValue?: Date;
    hmacValue?: string;
    error?: string;
}

export class HmacValidationService {
    private readonly secret: string;

    constructor(secret?: string) {
        if (!secret) {
            throw new Error('HMAC secret is required for validation');
        }
        this.secret = secret;
    }

    /**
     * Extracts HMAC from URL parameters (assumes it's the last parameter)
     * and returns the cleaned URL without the HMAC parameter
     */
    private extractHmacFromUrl(url: string): {hmac?: string; timestamp?: Date, cleanedUrl: string} {
        const urlObj = new URL(url, 'http://localhost'); // Base URL for relative URLs
        const params = new URLSearchParams(urlObj.search);

        const givenTimestamp = params.get('t');
        let timestamp = null;
        if (givenTimestamp) {
            timestamp = new Date(parseInt(givenTimestamp));
        }

        const hmac = params.get('hmac');

        params.delete('hmac');

        // Reconstruct the cleaned URL
        const cleanedSearch = params.toString();
        const cleanedUrl = urlObj.pathname + (cleanedSearch ? `?${cleanedSearch}` : '');

        return {
            hmac: hmac || undefined,
            timestamp: timestamp || undefined,
            cleanedUrl
        };
    }

    /**
     * Generates HMAC signature for the given data
     */
    generateHmac(data: string): string {
        return crypto
            .createHmac('sha1', this.secret)
            .update(data)
            .digest('hex');
    }

    /**
     * Performs timing-safe comparison of two strings
     */
    private timingSafeEqual(a: string, b: string): boolean {
        if (a.length !== b.length) {
            return false;
        }

        try {
            const bufferA = Buffer.from(a, 'hex');
            const bufferB = Buffer.from(b, 'hex');
            return crypto.timingSafeEqual(bufferA, bufferB);
        } catch {
            // Fallback to regular comparison if hex conversion fails
            return a === b;
        }
    }

    /**
     * Validates timestamp for a given request
     */
    private validateTimestamp(timestamp: Date): { timestampValid: boolean, timestampError?: string } {
        if (isNaN(timestamp.getTime())) {
            return {
                timestampValid: false,
                timestampError: 'Invalid timestamp'
            };
        }

        const currentTime = Date.now();
        const oldestTime = new Date(currentTime - (5 * 60 * 1000)); // 5 minutes ago
        const newestTime = new Date(currentTime + (5 * 1000)); // 5 seconds from now;

        if (timestamp <= newestTime && timestamp >= oldestTime) {
            return {
                timestampValid: true
            };
        }

        return {
            timestampValid: false,
            timestampError: 'Timestamp is not within the allowed range'
        };
    }

    /**
     * Validates HMAC for a given request
     * The HMAC is calculated based on: method + cleaned_url + body_hash
     */
    async validateRequest(request: FastifyRequest): Promise<HmacValidationResult> {
        try {
            const fullUrl = request.url;
            const {hmac: providedHmac, timestamp: providedTimestamp, cleanedUrl} = this.extractHmacFromUrl(fullUrl);

            if (!providedHmac) {
                return {
                    isValid: false,
                    cleanedUrl,
                    originalUrl: request.url,
                    error: 'HMAC parameter not found'
                };
            }

            if (!providedTimestamp) {
                return {
                    isValid: false,
                    cleanedUrl,
                    originalUrl: request.url,
                    error: 'Timestamp (t) parameter not found'
                };
            }

            const expectedHmac = this.generateHmac(cleanedUrl);

            const hmacValid = this.timingSafeEqual(providedHmac, expectedHmac);
            const {timestampValid, timestampError} = this.validateTimestamp(providedTimestamp);
            const isValid = hmacValid && timestampValid;

            return {
                isValid,
                cleanedUrl,
                originalUrl: request.url,
                hmacValue: providedHmac,
                timestampValue: providedTimestamp,
                error: timestampError || undefined
            };
        } catch (error) {
            return {
                isValid: false,
                cleanedUrl: request.url,
                originalUrl: request.url,
                error: error instanceof Error ? error.message : 'Unknown validation error'
            };
        }
    }
}

// Singleton instance
let hmacValidationService: HmacValidationService | null = null;

export function getHmacValidationService(): HmacValidationService {
    if (!hmacValidationService) {
        const secret = process.env.HMAC_SECRET;
        if (!secret) {
            throw new Error('HMAC_SECRET environment variable is required');
        }
        hmacValidationService = new HmacValidationService(secret);
    }
    return hmacValidationService;
}
