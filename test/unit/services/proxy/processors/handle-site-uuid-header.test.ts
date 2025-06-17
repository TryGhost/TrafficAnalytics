import {describe, it, expect, vi} from 'vitest';
import {handleSiteUUIDHeader} from '../../../../../src/services/proxy/processors/handle-site-uuid-header';
import {FastifyRequest, HttpProxyRequest} from '../../../../../src/types';

describe('Processors', () => {
    describe('handleSiteUUIDHeader', () => {
        it('should set site_uuid in payload when x-site-uuid header is present', () => {
            const request: Partial<HttpProxyRequest> = {
                headers: {
                    'x-site-uuid': '550e8400-e29b-41d4-a716-446655440000'
                },
                body: {
                    payload: {} as any
                } as any,
                log: {
                    error: vi.fn(),
                    info: () => {}
                } as any
            };
            
            handleSiteUUIDHeader(request as FastifyRequest);
            
            expect(request.body?.payload.site_uuid).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(request.log!.error).not.toHaveBeenCalled();
        });

        it('should throw error when x-site-uuid header is empty and no fallback exists', () => {
            const request: Partial<HttpProxyRequest> = {
                headers: {
                    'x-site-uuid': ''
                },
                body: {
                    payload: {} as any
                } as any,
                log: {
                    error: vi.fn(),
                    info: () => {}
                } as any
            };
            
            expect(() => handleSiteUUIDHeader(request as FastifyRequest)).toThrow('Site UUID is required but not found in header or body');
            expect(request.log!.error).toHaveBeenCalledWith(
                'Failed to get site UUID from request header:',
                expect.any(Error)
            );
        });

        it('should throw error when x-site-uuid header is missing and no fallback exists', () => {
            const request: Partial<HttpProxyRequest> = {
                headers: {},
                body: {
                    payload: {} as any
                } as any,
                log: {
                    error: vi.fn(),
                    info: () => {}
                } as any
            };
            
            expect(() => handleSiteUUIDHeader(request as FastifyRequest)).toThrow('Site UUID is required but not found in header or body');
            expect(request.log!.error).toHaveBeenCalledWith(
                'Failed to get site UUID from request header:',
                expect.any(Error)
            );
        });

        it('should throw error when x-site-uuid header is array and no fallback exists', () => {
            const request: Partial<HttpProxyRequest> = {
                headers: {
                    'x-site-uuid': ['uuid1', 'uuid2'] as any
                },
                body: {
                    payload: {} as any
                } as any,
                log: {
                    error: vi.fn(),
                    info: () => {}
                } as any
            };
            
            expect(() => handleSiteUUIDHeader(request as FastifyRequest)).toThrow('Site UUID is required but not found in header or body');
            expect(request.log!.error).toHaveBeenCalledWith(
                'Failed to get site UUID from request header:',
                expect.any(Error)
            );
        });

        it('should use site_uuid from body payload as fallback when header is missing', () => {
            const request: Partial<HttpProxyRequest> = {
                headers: {},
                body: {
                    payload: {
                        site_uuid: 'fallback-uuid'
                    } as any
                } as any,
                log: {
                    error: vi.fn(),
                    info: () => {}
                } as any
            };
            
            handleSiteUUIDHeader(request as FastifyRequest);
            
            expect(request.body?.payload.site_uuid).toBe('fallback-uuid');
            expect(request.log!.error).not.toHaveBeenCalled();
        });

        it('should use site_uuid from body payload as fallback when header is empty', () => {
            const request: Partial<HttpProxyRequest> = {
                headers: {
                    'x-site-uuid': ''
                },
                body: {
                    payload: {
                        site_uuid: 'fallback-uuid'
                    } as any
                } as any,
                log: {
                    error: vi.fn(),
                    info: () => {}
                } as any
            };
            
            handleSiteUUIDHeader(request as FastifyRequest);
            
            expect(request.body?.payload.site_uuid).toBe('fallback-uuid');
            expect(request.log!.error).not.toHaveBeenCalled();
        });

        it('should trim whitespace from header value', () => {
            const request: Partial<HttpProxyRequest> = {
                headers: {
                    'x-site-uuid': '  valid-uuid  '
                },
                body: {
                    payload: {} as any
                } as any,
                log: {
                    error: vi.fn(),
                    info: () => {}
                } as any
            };
            
            handleSiteUUIDHeader(request as FastifyRequest);
            
            expect(request.body?.payload.site_uuid).toBe('valid-uuid');
            expect(request.log!.error).not.toHaveBeenCalled();
        });

        it('should log and rethrow errors that occur during processing', () => {
            const request: Partial<HttpProxyRequest> = {
                headers: {
                    'x-site-uuid': '550e8400-e29b-41d4-a716-446655440000'
                },
                body: null as any, // This will cause an error when trying to access body.payload
                log: {
                    error: vi.fn(),
                    info: () => {}
                } as any
            };
            
            expect(() => handleSiteUUIDHeader(request as FastifyRequest)).toThrow();
            expect(request.log!.error).toHaveBeenCalledWith(
                'Failed to get site UUID from request header:',
                expect.any(Error)
            );
        });

        it('should overwrite existing site_uuid in payload', () => {
            const request: Partial<HttpProxyRequest> = {
                headers: {
                    'x-site-uuid': 'new-uuid'
                },
                body: {
                    payload: {
                        site_uuid: 'old-uuid'
                    } as any
                } as any,
                log: {
                    error: vi.fn(),
                    info: () => {}
                } as any
            };
            
            handleSiteUUIDHeader(request as FastifyRequest);
            
            expect(request.body?.payload.site_uuid).toBe('new-uuid');
            expect(request.log!.error).not.toHaveBeenCalled();
        });
    });
});