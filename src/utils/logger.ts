import pino from 'pino';
import type {LoggerOptions} from 'pino';
import type {PrettyOptions} from 'pino-pretty';
import type {FastifyRequest, FastifyReply} from 'fastify';
import {createGcpLoggingPinoConfig} from '@google-cloud/pino-logging-gcp-config';

/**
 * Get logger configuration based on environment
 */
export function getLoggerConfig(): LoggerOptions {
    // Disable logging in test environment
    if (process.env.NODE_ENV === 'testing') {
        return {level: 'silent'};
    }

    // Development configuration - simple pretty logs
    if (process.env.NODE_ENV === 'development') {
        return {
            level: process.env.LOG_LEVEL || 'info',
            transport: {
                target: 'pino-pretty',
                options: {
                    translateTime: 'HH:MM:ss',
                    ignore: 'pid,hostname', // hides JSON object
                    messageFormat: '{msg}',
                    singleLine: true,
                    colorize: true
                } as PrettyOptions
            },
            serializers: {
                req(request: FastifyRequest) {
                    return {
                        method: request.method,
                        url: request.url
                    };
                },
                res(reply: FastifyReply) {
                    return {
                        statusCode: reply.statusCode
                    };
                },
                err(error: Error) {
                    return {
                        message: error.message,
                        name: error.name,
                        code: 'code' in error ? (error as Error & {code: string}).code : undefined,
                        stack: error.stack
                    };
                }
            }
        };
    }

    // Production / staging configuration - GCP optimized JSON logs
    const gcpConfig = createGcpLoggingPinoConfig();
    return {
        ...gcpConfig,
        level: process.env.LOG_LEVEL || 'info',
        serializers: {
            ...gcpConfig.serializers,
            err(error: Error) {
                return {
                    message: error.message,
                    name: error.name,
                    code: 'code' in error ? (error as Error & {code: string}).code : undefined,
                    stack: error.stack
                };
            }
        }
    };
}

/**
 * Extract trace context from Cloud Run headers for log correlation
 */
export function extractTraceContext(request: FastifyRequest): Record<string, string | boolean> {
    const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
    const traceContext: Record<string, string | boolean> = {};

    // Extract from X-Cloud-Trace-Context header (Cloud Run format)
    const cloudTraceHeader = request.headers['x-cloud-trace-context'] as string;
    if (cloudTraceHeader && PROJECT_ID) {
        const [traceId, spanId] = cloudTraceHeader.split('/');
        if (traceId) {
            traceContext['logging.googleapis.com/trace'] = `projects/${PROJECT_ID}/traces/${traceId}`;
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
    if (traceparentHeader && PROJECT_ID && !traceContext['logging.googleapis.com/trace']) {
        const [version, traceId, spanId, traceFlags] = traceparentHeader.split('-');
        if (traceId && version === '00') {
            traceContext['logging.googleapis.com/trace'] = `projects/${PROJECT_ID}/traces/${traceId}`;
            traceContext['logging.googleapis.com/spanId'] = spanId;
            traceContext['logging.googleapis.com/trace_sampled'] = (parseInt(traceFlags, 16) & 1) === 1;
        }
    }

    return traceContext;
}

// Create the default logger instance
const logger = pino(getLoggerConfig());

export default logger;