import type {LoggerOptions} from 'pino';
import type {PrettyOptions} from 'pino-pretty';
import type {FastifyRequest, FastifyReply} from 'fastify';
import {createGcpLoggingPinoConfig} from '@google-cloud/pino-logging-gcp-config';

const LOG_FORMATS = ['gcp', 'json'] as const;

type LogFormat = typeof LOG_FORMATS[number];

/**
 * Pick the log format, preferring an explicit LOG_FORMAT over detection.
 *
 * `gcp` shapes every record for Cloud Logging; `json` is plain pino output for anywhere
 * else. Detection keeps existing deployments on `gcp` without new config: K_SERVICE
 * covers Cloud Run and Cloud Functions, GAE_SERVICE covers App Engine, and GKE and
 * Compute Engine set neither, so it falls back to GOOGLE_CLOUD_PROJECT, which this
 * service already requires for Firestore and Pub/Sub.
 */
function getLogFormat(): LogFormat {
    const configured = process.env.LOG_FORMAT;

    if (configured) {
        if (!LOG_FORMATS.includes(configured as LogFormat)) {
            throw new Error(`Invalid LOG_FORMAT '${configured}', expected one of: ${LOG_FORMATS.join(', ')}`);
        }

        return configured as LogFormat;
    }

    const onGoogleCloud = process.env.K_SERVICE || process.env.GAE_SERVICE || process.env.GOOGLE_CLOUD_PROJECT;

    return onGoogleCloud ? 'gcp' : 'json';
}

function getServiceContext(): {service: string; version?: string} {
    const isWorkerMode = process.env.WORKER_MODE === 'true';
    const service = process.env.K_SERVICE || (isWorkerMode ? 'analytics-worker' : 'analytics-service');
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

    const level = process.env.LOG_LEVEL || 'info';

    // Plain JSON for non-GCP hosts. The GCP config rewrites records into Cloud Logging's
    // shape and looks up a project ID via the metadata server, neither of which means
    // anything off GCP.
    if (getLogFormat() === 'json') {
        return {level};
    }

    // Production / staging configuration - GCP optimized JSON logs
    return createGcpLoggingPinoConfig(
        {
            serviceContext: getServiceContext(),
            inihibitDiagnosticMessage: Boolean(process.env.VITEST)
        },
        {level}
    );
}
