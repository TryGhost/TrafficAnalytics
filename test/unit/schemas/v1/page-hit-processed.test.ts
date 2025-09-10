import {describe, it, expect, vi, beforeEach} from 'vitest';
import {Value} from '@sinclair/typebox/value';
import {
    PageHitProcessedSchema,
    transformUserAgent,
    transformReferrer,
    generateUserSignature,
    transformPageHitRawToProcessed,
    PageHitRaw,
    ParsedReferrer
} from '../../../../src/schemas';

// Mock the @tryghost/referrer-parser module
vi.mock('@tryghost/referrer-parser', async () => {
    const ReferrerParser = vi.fn().mockImplementation(() => ({
        parse: vi.fn().mockImplementation((url, source, medium) => ({
            referrerUrl: url,
            referrerSource: source,
            referrerMedium: medium || 'unknown'
        }))
    }));

    return {
        ReferrerParser
    };
});

const validPageHitRaw: PageHitRaw = {
    timestamp: '2024-01-01T00:00:00.000Z',
    action: 'page_hit',
    version: '1',
    site_uuid: '12345678-1234-1234-1234-123456789012',
    payload: {
        event_id: '550e8400-e29b-41d4-a716-446655440000',
        member_uuid: 'undefined',
        member_status: 'free',
        post_uuid: 'undefined',
        post_type: 'post',
        locale: 'en-US',
        location: 'homepage',
        parsedReferrer: {
            url: 'https://www.google.com/search?q=ghost+cms',
            source: 'Google',
            medium: 'search'
        },
        pathname: '/blog/post',
        href: 'https://example.com/blog/post',
        utmSource: 'newsletter',
        utmMedium: 'email',
        utmCampaign: 'summer-sale',
        utmTerm: 'ghost-cms',
        utmContent: 'header-link'
    },
    meta: {
        ip: '192.168.1.1',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
};

describe('PageHitProcessedSchema v1', () => {
    beforeEach(function () {
        vi.clearAllMocks();
    });
    const validPageHitProcessed = {
        timestamp: '2024-01-01T00:00:00.000Z',
        action: 'page_hit',
        version: '1',
        site_uuid: '12345678-1234-1234-1234-123456789012',
        session_id: 'abc123def456',
        payload: {
            event_id: '550e8400-e29b-41d4-a716-446655440000',
            site_uuid: '12345678-1234-1234-1234-123456789012',
            member_uuid: 'undefined',
            member_status: 'free',
            post_uuid: 'undefined',
            post_type: 'post',
            locale: 'en-US',
            location: 'homepage',
            pathname: '/blog/post',
            href: 'https://example.com/blog/post',
            parsedReferrer: {
                url: 'https://www.google.com/search?q=ghost+cms',
                source: 'Google',
                medium: 'search'
            },
            os: 'macos',
            browser: 'chrome',
            device: 'desktop',
            referrerUrl: 'https://www.google.com/search?q=ghost+cms',
            referrerSource: 'Google',
            referrerMedium: 'search',
            utmSource: 'newsletter',
            utmMedium: 'email',
            utmCampaign: 'summer-sale',
            utmTerm: 'ghost-cms',
            utmContent: 'header-link',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    };

    it('should validate valid page hit processed data', () => {
        expect(Value.Check(PageHitProcessedSchema, validPageHitProcessed)).toBe(true);
    });

    it('should require session_id field', () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, camelcase
        const {session_id, ...invalidData} = validPageHitProcessed;
        expect(Value.Check(PageHitProcessedSchema, invalidData)).toBe(false);
    });

    it('should not be too strict about the href value', async () => {
        const pageHitRawWithWeirdHref: PageHitRaw = {
            ...validPageHitRaw,
            payload: {
                ...validPageHitRaw.payload,
                href: 'not-a-url'
            }
        };

        const result = await transformPageHitRawToProcessed(pageHitRawWithWeirdHref);

        expect(result.payload.href).toBe('not-a-url');
    });

    describe('processed payload fields validation', () => {
        it('should require os field', () => {
            const invalidData = {
                ...validPageHitProcessed,
                payload: {
                    ...validPageHitProcessed.payload,
                    os: undefined
                }
            };
            expect(Value.Check(PageHitProcessedSchema, invalidData)).toBe(false);
        });

        it('should require browser field', () => {
            const invalidData = {
                ...validPageHitProcessed,
                payload: {
                    ...validPageHitProcessed.payload,
                    browser: undefined
                }
            };
            expect(Value.Check(PageHitProcessedSchema, invalidData)).toBe(false);
        });

        it('should require device field', () => {
            const invalidData = {
                ...validPageHitProcessed,
                payload: {
                    ...validPageHitProcessed.payload,
                    device: undefined
                }
            };
            expect(Value.Check(PageHitProcessedSchema, invalidData)).toBe(false);
        });

        it('should require user-agent field', () => {
            const invalidData = {
                ...validPageHitProcessed,
                payload: {
                    ...validPageHitProcessed.payload,
                    'user-agent': undefined
                }
            };
            expect(Value.Check(PageHitProcessedSchema, invalidData)).toBe(false);
        });

        it('should allow optional referrer fields', () => {
            const validData = {
                ...validPageHitProcessed,
                payload: {
                    ...validPageHitProcessed.payload,
                    referrer_url: undefined,
                    referrer_source: undefined,
                    referrer_medium: undefined
                }
            };
            expect(Value.Check(PageHitProcessedSchema, validData)).toBe(true);
        });

        it('should validate with all referrer fields present', () => {
            const validData = {
                ...validPageHitProcessed,
                payload: {
                    ...validPageHitProcessed.payload,
                    referrerUrl: 'https://twitter.com',
                    referrerSource: 'Twitter',
                    referrerMedium: 'social'
                }
            };
            expect(Value.Check(PageHitProcessedSchema, validData)).toBe(true);
        });
    });
    describe('transformUserAgent', () => {
        it('should parse Chrome on macOS correctly', () => {
            const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
            const result = transformUserAgent(userAgent);
        
            expect(result.os).toBe('macos');
            expect(result.browser).toBe('chrome');
            expect(result.device).toBe('desktop');
        });

        it('should parse Safari on iOS correctly', () => {
            const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15';
            const result = transformUserAgent(userAgent);
        
            expect(result.os).toBe('ios');
            expect(result.browser).toBe('safari');
            expect(result.device).toBe('mobile-ios');
        });

        it('should parse Chrome on Android correctly', () => {
            const userAgent = 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36';
            const result = transformUserAgent(userAgent);
        
            expect(result.os).toBe('android');
            expect(result.browser).toBe('chrome');
            expect(result.device).toBe('mobile-android');
        });

        it('should parse Firefox on Windows correctly', () => {
            const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0';
            const result = transformUserAgent(userAgent);
        
            expect(result.os).toBe('windows');
            expect(result.browser).toBe('firefox');
            expect(result.device).toBe('desktop');
        });

        it('should parse Firefox on Linux correctly', () => {
            const userAgent = 'Mozilla/5.0 (X11; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0';
            const result = transformUserAgent(userAgent);
        
            expect(result.os).toBe('linux');
            expect(result.browser).toBe('firefox');
            expect(result.device).toBe('desktop');
        });

        it('should detect bots correctly', () => {
            const botUserAgents = [
                'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
                'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
                'wget/1.21.1',
                'curl/7.68.0'
            ];

            botUserAgents.forEach((userAgent) => {
                const result = transformUserAgent(userAgent);
                expect(result.device).toBe('bot');
            });
        });

        it('should normalize mobile browser names', () => {
            const mobileUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1';
            const result = transformUserAgent(mobileUserAgent);
        
            expect(result.browser).toBe('safari');
        });

        it('should normalize Mac OS to macOS', () => {
            const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
            const result = transformUserAgent(userAgent);
        
            expect(result.os).toBe('macos');
        });

        it('should handle empty user agent', () => {
            const result = transformUserAgent('');
        
            expect(result.os).toBe('unknown');
            expect(result.browser).toBe('unknown');
            expect(result.device).toBe('unknown');
        });

        it('should handle malformed user agent', () => {
            const result = transformUserAgent('invalid-user-agent');
        
            expect(result.os).toBe('unknown');
            expect(result.browser).toBe('unknown');
            expect(result.device).toBe('unknown');
        });

        it('should handle Chrome OS correctly', () => {
            const userAgent = 'Mozilla/5.0 (X11; CrOS x86_64 13816.64.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.100 Safari/537.36';
            const result = transformUserAgent(userAgent);
        
            expect(result.os).toBe('chromium os');
            expect(result.browser).toBe('chrome');
            expect(result.device).toBe('desktop');
        });

        it('should handle Ubuntu correctly', () => {
            const userAgent = 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0';
            const result = transformUserAgent(userAgent);
        
            expect(result.os).toBe('ubuntu');
            expect(result.browser).toBe('firefox');
            expect(result.device).toBe('desktop');
        });

        it('should detect Googlebot as bot even with Android user agent', () => {
            const userAgent = 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.7151.119 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
            const result = transformUserAgent(userAgent);
        
            expect(result.os).toBe('android');
            expect(result.browser).toBe('chrome');
            expect(result.device).toBe('bot'); // Should be 'bot', not 'mobile-android'
        });

        it('should detect various bots even with mobile OS user agents', () => {
            // Googlebot with iOS user agent
            const googleBotiOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/605.1 NAVER(inapp; search; 2000; 12.13.0; 16PROMAX) (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
            let result = transformUserAgent(googleBotiOS);
            expect(result.device).toBe('bot');
            expect(result.os).toBe('ios');

            // AhrefsBot with Android
            const ahrefsBotAndroid = 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.101 Mobile Safari/537.36 AhrefsBot/7.0';
            result = transformUserAgent(ahrefsBotAndroid);
            expect(result.device).toBe('bot');
            expect(result.os).toBe('android');

            // Simple bot patterns should still work
            const curlBot = 'curl/7.64.1';
            result = transformUserAgent(curlBot);
            expect(result.device).toBe('bot');
        });
    });

    describe('transformReferrer', () => {
        it('should parse referrer data correctly', () => {
            const referrer = {
                url: 'https://www.google.com/search?q=ghost+cms',
                source: 'Google',
                medium: 'search'
            };
            const result = transformReferrer(referrer);
        
            expect(result.referrerUrl).toBe('https://www.google.com/search?q=ghost+cms');
            expect(result.referrerSource).toBe('Google');
            expect(result.referrerMedium).toBe('search');
        });

        it('should return empty object if referrer is undefined', () => {
            const result = transformReferrer(undefined);
            expect(result).toEqual({});
        });

        it('should return empty object if referrer is not an object', () => {
            const referrer = 'not-an-object' as unknown as ParsedReferrer;
            const result = transformReferrer(referrer);
            expect(result).toEqual({});
        });

        it('should return empty object if referrer is an empty object', () => {
            const referrer = {} as unknown as ParsedReferrer;
            const result = transformReferrer(referrer);
            expect(result).toEqual({});
        });
    });

    describe('generateUserSignature', () => {
        it('should generate consistent signature for same inputs', async () => {
            const siteUuid = '12345678-1234-1234-1234-123456789012';
            const ipAddress = '192.168.1.1';
            const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
        
            const signature1 = await generateUserSignature(siteUuid, ipAddress, userAgent);
            const signature2 = await generateUserSignature(siteUuid, ipAddress, userAgent);
        
            expect(signature1).toBe(signature2);
            expect(signature1).toHaveLength(64); // SHA-256 hex string length
        });

        it('should generate different signatures for different inputs', async () => {
            const siteUuid = '12345678-1234-1234-1234-123456789012';
            const ipAddress1 = '192.168.1.1';
            const ipAddress2 = '192.168.1.2';
            const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
        
            const signature1 = await generateUserSignature(siteUuid, ipAddress1, userAgent);
            const signature2 = await generateUserSignature(siteUuid, ipAddress2, userAgent);
        
            expect(signature1).not.toBe(signature2);
        });
    });

    describe('transformPageHitRawToProcessed', () => {
        it('should transform complete page hit raw to processed', async () => {
            const result = await transformPageHitRawToProcessed(validPageHitRaw);
        
            expect(result.timestamp).toBe(validPageHitRaw.timestamp);
            expect(result.action).toBe(validPageHitRaw.action);
            expect(result.version).toBe(validPageHitRaw.version);
            expect(result.site_uuid).toBe(validPageHitRaw.site_uuid);
            expect(result.session_id).toBeDefined();
            expect(typeof result.session_id).toBe('string');
            expect(result.session_id).toHaveLength(64);
        
            // Check original payload fields are preserved
            expect(result.payload.site_uuid).toBe(validPageHitRaw.site_uuid);
            expect(result.payload.member_uuid).toBe(validPageHitRaw.payload.member_uuid);
            expect(result.payload.member_status).toBe(validPageHitRaw.payload.member_status);
            expect(result.payload.pathname).toBe(validPageHitRaw.payload.pathname);
            expect(result.payload.href).toBe(validPageHitRaw.payload.href);
        
            // Check processed fields are added
            expect(result.payload.os).toBe('macos');
            expect(result.payload.browser).toBe('chrome');
            expect(result.payload.device).toBe('desktop');

            expect(result.payload.referrerUrl).toBe('https://www.google.com/search?q=ghost+cms');
            expect(result.payload.referrerSource).toBe('Google');
            expect(result.payload.referrerMedium).toBe('search');
            
            // Check that parsedReferrer contains original referrer data (without UTM)
            expect(result.payload.parsedReferrer).toEqual({
                url: 'https://www.google.com/search?q=ghost+cms',
                source: 'Google',
                medium: 'search'
            });
            
            // Check that UTM params are at top level
            expect(result.payload.utmSource).toBe('newsletter');
            expect(result.payload.utmMedium).toBe('email');
            expect(result.payload.utmCampaign).toBe('summer-sale');
            expect(result.payload.utmTerm).toBe('ghost-cms');
            expect(result.payload.utmContent).toBe('header-link');
            
            expect((result.payload as any).referrer).toBeUndefined();
            expect(result.payload['user-agent']).toBe(validPageHitRaw.meta['user-agent']);
        
            // Check meta is not included in processed output
            expect(result).not.toHaveProperty('meta');
        });

        it('should handle page hit raw with bot user agent', async () => {
            const pageHitRawWithBot: PageHitRaw = {
                ...validPageHitRaw,
                meta: {
                    ...validPageHitRaw.meta,
                    'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
                }
            };
        
            const result = await transformPageHitRawToProcessed(pageHitRawWithBot);
        
            expect(result.payload.device).toBe('bot');
            expect(result.payload.os).toBe('unknown');
            expect(result.payload.browser).toBe('unknown');
            expect(result.payload['user-agent']).toBe(pageHitRawWithBot.meta['user-agent']);
        });

        it('should handle page hit raw with mobile user agent', async () => {
            const pageHitRawWithMobile: PageHitRaw = {
                ...validPageHitRaw,
                meta: {
                    ...validPageHitRaw.meta,
                    'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15'
                }
            };
        
            const result = await transformPageHitRawToProcessed(pageHitRawWithMobile);
        
            expect(result.payload.device).toBe('mobile-ios');
            expect(result.payload.os).toBe('ios');
            expect(result.payload.browser).toBe('safari');
            expect(result.payload['user-agent']).toBe(pageHitRawWithMobile.meta['user-agent']);
        });

        it('should generate different session IDs for different page hits', async () => {
            const pageHitRaw1 = {
                ...validPageHitRaw,
                meta: {
                    ...validPageHitRaw.meta,
                    ip: '192.168.1.1'
                }
            };
            const pageHitRaw2 = {
                ...validPageHitRaw,
                meta: {
                    ...validPageHitRaw.meta,
                    ip: '192.168.1.2'
                }
            };
        
            const result1 = await transformPageHitRawToProcessed(pageHitRaw1);
            const result2 = await transformPageHitRawToProcessed(pageHitRaw2);
        
            expect(result1.session_id).not.toBe(result2.session_id);
        });

        it('should handle page hit raw without UTM parameters', async () => {
            const pageHitRawWithoutUTM: PageHitRaw = {
                ...validPageHitRaw,
                payload: {
                    ...validPageHitRaw.payload,
                    utmSource: null,
                    utmMedium: null,
                    utmCampaign: null,
                    utmTerm: null,
                    utmContent: null
                }
            };
        
            const result = await transformPageHitRawToProcessed(pageHitRawWithoutUTM);
        
            // Check that UTM params are null at top level
            expect(result.payload.utmSource).toBeNull();
            expect(result.payload.utmMedium).toBeNull();
            expect(result.payload.utmCampaign).toBeNull();
            expect(result.payload.utmTerm).toBeNull();
            expect(result.payload.utmContent).toBeNull();
            
            // Check that parsedReferrer still contains original referrer data
            expect(result.payload.parsedReferrer).toEqual({
                url: 'https://www.google.com/search?q=ghost+cms',
                source: 'Google',
                medium: 'search'
            });
        });

        it('should produce valid PageHitProcessed schema', async () => {
            const result = await transformPageHitRawToProcessed(validPageHitRaw);
        
            expect(Value.Check(PageHitProcessedSchema, result)).toBe(true);
        });
    });
});