import pino from 'pino';
import type {LoggerOptions} from 'pino';
import type {PrettyOptions} from 'pino-pretty';
import type {FastifyRequest, FastifyReply} from 'fastify';
import {createGcpLoggingPinoConfig} from '@google-cloud/pino-logging-gcp-config';

interface LogRecord {
    trace_id?: string;
    span_id?: string;
    trace_flags?: string;
    [key: string]: unknown;
}

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
        formatters: {
            log(object: LogRecord): Record<string, unknown> {
                // Add trace context attributes following Cloud Logging structured log format described
                // in https://cloud.google.com/logging/docs/structured-logging#special-payload-fields

                /* eslint-disable camelcase */
                const {trace_id, span_id, trace_flags, ...rest} = object;

                return {
                    'logging.googleapis.com/trace': trace_id,
                    'logging.googleapis.com/spanId': span_id,
                    'logging.googleapis.com/trace_sampled': trace_flags
                        ? trace_flags === '01'
                        : undefined,
                    ...rest
                };
            }
        },
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

// Create the default logger instance
const logger = pino(getLoggerConfig());

export default logger;
