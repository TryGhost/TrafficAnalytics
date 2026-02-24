import type {FastifyRequest} from 'fastify';

interface GenericTraceContext {
    trace_id?: string;
    span_id?: string;
    trace_flags?: string;
}

/**
 * Extract trace context from Cloud Run headers for log correlation
 */
export function extractTraceContext(request: FastifyRequest): GenericTraceContext {
    const traceContext: GenericTraceContext = {};

    // Extract from X-Cloud-Trace-Context header (Cloud Run format)
    const cloudTraceHeader = request.headers['x-cloud-trace-context'] as string;
    if (cloudTraceHeader) {
        const [traceId, spanId] = cloudTraceHeader.split('/');
        if (traceId) {
            traceContext.trace_id = traceId;
        }
        if (spanId) {
            const [spanIdPart, traceSampled] = spanId.split(';o=');
            traceContext.span_id = spanIdPart;
            if (traceSampled) {
                traceContext.trace_flags = traceSampled === '1' ? '01' : '00';
            }
        }
    }

    // Also support W3C traceparent header (standard format)
    const traceparentHeader = request.headers.traceparent as string;
    if (traceparentHeader && !traceContext.trace_id) {
        const [version, traceId, spanId, traceFlags] = traceparentHeader.split('-');
        if (traceId && version === '00') {
            traceContext.trace_id = traceId;
            traceContext.span_id = spanId;
            traceContext.trace_flags = (parseInt(traceFlags, 16) & 1) === 1 ? '01' : '00';
        }
    }

    return traceContext;
}
