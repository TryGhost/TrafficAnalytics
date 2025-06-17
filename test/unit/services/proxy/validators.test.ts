import {describe, it, expect} from 'vitest';
import * as validators from '../../../../src/services/proxy/validators';
import {FastifyRequest} from '../../../../src/types';

const {validateQueryParams, validateRequestBody, validateSiteUUID} = validators;

describe('Validators', () => {
    describe('validateQueryParams', () => {
        it('should throw an error if the token is not provided', () => {
            const request = {query: {token: ''}} as FastifyRequest;
            expect(() => validateQueryParams(request)).toThrow();
        });

        it('should throw an error if the name is not provided', () => {
            const request = {query: {token: 'abc123', name: ''}} as FastifyRequest;
            expect(() => validateQueryParams(request)).toThrow();
        });
    });

    describe('validateRequestBody', () => {
        it('should throw an error if the request body is not provided', () => {
            const request = {} as FastifyRequest;
            expect(() => validateRequestBody(request)).toThrow();
        });

        it('should throw an error if the request body is empty', () => {
            const request = {body: {}} as FastifyRequest;
            expect(() => validateRequestBody(request)).toThrow();
        });
    });

    describe('validateSiteUUID', () => {
        it('should throw an error if x-site-uuid header is missing and no fallback is available', () => {
            const request = {
                headers: {},
                body: {
                    payload: {
                        site_uuid: ''
                    }
                }
            } as unknown as FastifyRequest;
            expect(() => validateSiteUUID(request)).toThrow('x-site-uuid header is required');
        });

        it('should throw an error if x-site-uuid header is empty string and no fallback is available', () => {
            const request = {
                headers: {
                    'x-site-uuid': ''
                },
                body: {
                    payload: {
                        site_uuid: ''
                    }
                }
            } as unknown as FastifyRequest;
            expect(() => validateSiteUUID(request)).toThrow('x-site-uuid header is required');
        });

        it('should throw an error if x-site-uuid header is whitespace only and no fallback is available', () => {
            const request = {
                headers: {
                    'x-site-uuid': '   '
                },
                body: {
                    payload: {
                        site_uuid: ''
                    }
                }
            } as unknown as FastifyRequest;
            expect(() => validateSiteUUID(request)).toThrow('x-site-uuid header is required');
        });

        it('should return the UUID when valid x-site-uuid header is provided', () => {
            const request = {
                headers: {
                    'x-site-uuid': '550e8400-e29b-41d4-a716-446655440000'
                },
                body: {
                    payload: {}
                }
            } as unknown as FastifyRequest;
            const result = validateSiteUUID(request);
            expect(result).toBe('550e8400-e29b-41d4-a716-446655440000');
        });

        it('should throw an error if x-site-uuid header is an array (multiple values)', () => {
            const request = {
                headers: {
                    'x-site-uuid': ['uuid1', 'uuid2'] as any
                },
                body: {
                    payload: {}
                }
            } as unknown as FastifyRequest;
            expect(() => validateSiteUUID(request)).toThrow('x-site-uuid header should be a single value');
        });

        it('should use site_uuid from body payload as fallback when header is missing', () => {
            const request = {
                headers: {},
                body: {
                    payload: {
                        site_uuid: 'fallback-uuid'
                    }
                }
            } as unknown as FastifyRequest;
            const result = validateSiteUUID(request);
            expect(result).toBe('fallback-uuid');
        });

        it('should use site_uuid from body payload as fallback when header is empty', () => {
            const request = {
                headers: {
                    'x-site-uuid': ''
                },
                body: {
                    payload: {
                        site_uuid: 'fallback-uuid'
                    }
                }
            } as unknown as FastifyRequest;
            const result = validateSiteUUID(request);
            expect(result).toBe('fallback-uuid');
        });

        it('should prioritize header value over body payload value', () => {
            const request = {
                headers: {
                    'x-site-uuid': 'header-uuid'
                },
                body: {
                    payload: {
                        site_uuid: 'body-uuid'
                    }
                }
            } as unknown as FastifyRequest;
            const result = validateSiteUUID(request);
            expect(result).toBe('header-uuid');
        });

        it('should trim whitespace from header value', () => {
            const request = {
                headers: {
                    'x-site-uuid': '  valid-uuid  '
                },
                body: {
                    payload: {}
                }
            } as unknown as FastifyRequest;
            const result = validateSiteUUID(request);
            expect(result).toBe('valid-uuid');
        });

        it('should throw when header is empty and body is undefined', () => {
            const request = {
                headers: {
                    'x-site-uuid': ''
                }
            } as unknown as FastifyRequest;
            // When body is undefined, siteUUID becomes undefined
            expect(() => validateSiteUUID(request)).toThrow('x-site-uuid header is required');
        });
    });
});