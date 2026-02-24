import type {LoggerOptions} from 'pino';
import type {PrettyOptions} from 'pino-pretty';
import type {FastifyRequest, FastifyReply} from 'fastify';
import {createGcpLoggingPinoConfig} from '@google-cloud/pino-logging-gcp-config';

function getServiceContext(): {service: string; version?: string} {
    const service = process.env.K_SERVICE || (process.env.WORKER_MODE ? 'analytics-worker' : 'analytics-service');
    const version = process.env.K_REVISION || process.env.npm_package_version;

    return version ? {service, version} : {service};
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
                }
            }
        };
    }

    // Production / staging configuration - GCP optimized JSON logs
    return createGcpLoggingPinoConfig(
        {
            serviceContext: getServiceContext(),
            inihibitDiagnosticMessage: Boolean(process.env.VITEST)
        },
        {
            level: process.env.LOG_LEVEL || 'info'
        }
    );
}
