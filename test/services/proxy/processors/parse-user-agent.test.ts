import {describe, it, expect} from 'vitest';
import * as processors from '../../../../src/services/proxy/processors/parse-user-agent';
import {FastifyRequest, HttpProxyRequest} from '../../../../src/types';

const {parseUserAgent} = processors;

describe('Processors', () => {
    describe('parseUserAgent', () => {
        it('should parse a desktop user agent', () => {
            const request: Partial<HttpProxyRequest> = {
                headers: {
                    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
                },
                body: {
                    payload: {}
                },
                log: {
                    error: () => {},
                    info: () => {}
                }
            };
            parseUserAgent(request as FastifyRequest);

            expect(request.body?.payload).toEqual({
                os: 'macos',
                browser: 'chrome',
                device: 'desktop'
            });
        });

        it('should normalize mobile browser names', () => {
            const request: Partial<HttpProxyRequest> = {
                headers: {
                    'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Mobile/15E148 Safari/604.1'
                },
                body: {
                    payload: {}
                },
                log: {
                    error: () => {},
                    info: () => {}
                }
            };
            parseUserAgent(request as FastifyRequest);
            // ua-parser-js returns 'Mobile Safari' before normalization
            expect(request.body?.payload.browser).toBe('safari');
        });

        it('should normalize Mac OS and macOS to macos', () => {
            const request: Partial<HttpProxyRequest> = {
                headers: {
                    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
                },
                body: {
                    payload: {}
                },
                log: {
                    error: () => {},
                    info: () => {}
                }
            };
            parseUserAgent(request as FastifyRequest);

            expect(request.body?.payload.os).toBe('macos');
        });

        it('should identify obvious bots and set the device to bot', () => {
            const request: Partial<HttpProxyRequest> = {
                headers: {
                    'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
                },
                body: {
                    payload: {}
                },
                log: {
                    error: () => {},
                    info: () => {}
                }
            };
            parseUserAgent(request as FastifyRequest);

            expect(request.body?.payload.device).toBe('bot');
        });

        it('should return unknown values if the user agent is not present', () => {
            const request: Partial<HttpProxyRequest> = {
                headers: {},
                body: {
                    payload: {}
                },
                log: {
                    error: () => {},
                    info: () => {}
                }
            };
            parseUserAgent(request as FastifyRequest);

            expect(request.body?.payload).toEqual({
                os: 'unknown',
                browser: 'unknown',
                device: 'unknown'
            });
        });
    });
});
