import type {FastifyRequest} from 'fastify';

/**
 * Extract trace context from Cloud Run headers for log correlation
 */
export function extractTraceContext(request: FastifyRequest): Record<string, string | boolean> {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    const traceContext: Record<string, string | boolean> = {};

    // Extract from X-Cloud-Trace-Context header (Cloud Run format)
    const cloudTraceHeader = request.headers['x-cloud-trace-context'] as string;
    if (cloudTraceHeader && projectId) {
        const [traceId, spanId] = cloudTraceHeader.split('/');
        if (traceId) {
            traceContext['logging.googleapis.com/trace'] = `projects/${projectId}/traces/${traceId}`;
        }
        if (spanId) {
            const [spanIdPart, traceSampled] = spanId.split(';o=');
            traceContext['logging.googleapis.com/spanId'] = spanIdPart;
            if (traceSampled) {
                traceContext['logging.googleapis.com/trace_sampled'] = traceSampled === '1';
            }
        }
    }

    // Also support W3C traceparent header (standard format)
    const traceparentHeader = request.headers.traceparent as string;
    if (traceparentHeader && projectId && !traceContext['logging.googleapis.com/trace']) {
        const [version, traceId, spanId, traceFlags] = traceparentHeader.split('-');
        if (traceId && version === '00') {
            traceContext['logging.googleapis.com/trace'] = `projects/${projectId}/traces/${traceId}`;
            traceContext['logging.googleapis.com/spanId'] = spanId;
            traceContext['logging.googleapis.com/trace_sampled'] = (parseInt(traceFlags, 16) & 1) === 1;
        }
    }

    return traceContext;
}
