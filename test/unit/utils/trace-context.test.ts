import {describe, it, expect} from 'vitest';
import {extractTraceContext} from '../../../src/utils/trace-context';
import type {FastifyRequest} from 'fastify';

describe('Trace Context Utilities', () => {
    describe('extractTraceContext', () => {
        it('should extract trace context from X-Cloud-Trace-Context header', () => {
            const mockRequest = {
                headers: {
                    'x-cloud-trace-context': '105445aa7843bc8bf206b12000100000/1;o=1'
                }
            } as unknown as FastifyRequest;

            const result = extractTraceContext(mockRequest);

            expect(result).toEqual({
                trace_id: '105445aa7843bc8bf206b12000100000',
                span_id: '1',
                trace_flags: '01'
            });
        });

        it('should extract trace context from X-Cloud-Trace-Context header without sampling flag', () => {
            const mockRequest = {
                headers: {
                    'x-cloud-trace-context': '105445aa7843bc8bf206b12000100000/1'
                }
            } as unknown as FastifyRequest;

            const result = extractTraceContext(mockRequest);

            expect(result).toEqual({
                trace_id: '105445aa7843bc8bf206b12000100000',
                span_id: '1'
            });
        });

        it('should extract trace context from X-Cloud-Trace-Context header with sampling disabled', () => {
            const mockRequest = {
                headers: {
                    'x-cloud-trace-context': '105445aa7843bc8bf206b12000100000/1;o=0'
                }
            } as unknown as FastifyRequest;

            const result = extractTraceContext(mockRequest);

            expect(result).toEqual({
                trace_id: '105445aa7843bc8bf206b12000100000',
                span_id: '1',
                trace_flags: '00'
            });
        });

        it('should extract trace context from traceparent header (W3C format)', () => {
            const mockRequest = {
                headers: {
                    traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
                }
            } as unknown as FastifyRequest;

            const result = extractTraceContext(mockRequest);

            expect(result).toEqual({
                trace_id: '4bf92f3577b34da6a3ce929d0e0e4736',
                span_id: '00f067aa0ba902b7',
                trace_flags: '01'
            });
        });

        it('should prefer X-Cloud-Trace-Context over traceparent when both are present', () => {
            const mockRequest = {
                headers: {
                    'x-cloud-trace-context': '105445aa7843bc8bf206b12000100000/1;o=1',
                    traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
                }
            } as unknown as FastifyRequest;

            const result = extractTraceContext(mockRequest);

            expect(result).toEqual({
                trace_id: '105445aa7843bc8bf206b12000100000',
                span_id: '1',
                trace_flags: '01'
            });
        });

        it('should handle traceparent with sampling disabled', () => {
            const mockRequest = {
                headers: {
                    traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
                }
            } as unknown as FastifyRequest;

            const result = extractTraceContext(mockRequest);

            expect(result).toEqual({
                trace_id: '4bf92f3577b34da6a3ce929d0e0e4736',
                span_id: '00f067aa0ba902b7',
                trace_flags: '00'
            });
        });

        it('should return empty object when no trace headers are present', () => {
            const mockRequest = {
                headers: {}
            } as unknown as FastifyRequest;

            const result = extractTraceContext(mockRequest);

            expect(result).toEqual({});
        });

        it('should handle malformed X-Cloud-Trace-Context header gracefully', () => {
            const mockRequest = {
                headers: {
                    'x-cloud-trace-context': 'malformed-header'
                }
            } as unknown as FastifyRequest;

            const result = extractTraceContext(mockRequest);

            expect(result).toEqual({
                trace_id: 'malformed-header'
            });
        });

        it('should handle malformed traceparent header gracefully', () => {
            const mockRequest = {
                headers: {
                    traceparent: 'malformed-header'
                }
            } as unknown as FastifyRequest;

            const result = extractTraceContext(mockRequest);

            expect(result).toEqual({});
        });

        it('should ignore traceparent with unsupported version', () => {
            const mockRequest = {
                headers: {
                    traceparent: '01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
                }
            } as unknown as FastifyRequest;

            const result = extractTraceContext(mockRequest);

            expect(result).toEqual({});
        });

        it('should handle empty trace ID in X-Cloud-Trace-Context', () => {
            const mockRequest = {
                headers: {
                    'x-cloud-trace-context': '/1;o=1'
                }
            } as unknown as FastifyRequest;

            const result = extractTraceContext(mockRequest);

            expect(result).toEqual({
                span_id: '1',
                trace_flags: '01'
            });
        });
    });
});
