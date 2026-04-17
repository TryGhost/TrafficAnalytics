import type {LoggerOptions, TransportTargetOptions} from 'pino';
import type {PrettyOptions} from 'pino-pretty';
import type {FastifyRequest, FastifyReply} from 'fastify';
import {createGcpLoggingPinoConfig} from '@google-cloud/pino-logging-gcp-config';

function getServiceContext(): {service: string; version?: string} {
    const isWorkerMode = process.env.WORKER_MODE === 'true';
    const service = process.env.K_SERVICE || (isWorkerMode ? 'analytics-worker' : 'analytics-service');
    const version = process.env.K_REVISION || process.env.npm_package_version;

    return version ? {service, version} : {service};
}

function getStdoutTransportTarget(): TransportTargetOptions {
    return {
        target: 'pino/file',
        options: {
            destination: 1
        }
    };
}

function getAxiomTransportTarget(): TransportTargetOptions | undefined {
    const token = process.env.AXIOM_TOKEN;
    const dataset = process.env.AXIOM_DATASET;

    if (!token || !dataset) {
        return undefined;
    }

    return {
        target: '@axiomhq/pino',
        level: process.env.AXIOM_LOG_LEVEL || process.env.LOG_LEVEL || 'info',
        options: {
            token,
            dataset,
            ...(process.env.AXIOM_ORG_ID ? {orgId: process.env.AXIOM_ORG_ID} : {}),
            ...(process.env.AXIOM_URL ? {url: process.env.AXIOM_URL} : {})
        }
    };
}

function getProductionTransport(): LoggerOptions['transport'] | undefined {
    const axiomTarget = getAxiomTransportTarget();

    if (!axiomTarget) {
        return undefined;
    }

    return {
        targets: [
            getStdoutTransportTarget(),
            axiomTarget
        ]
    };
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
    const config = createGcpLoggingPinoConfig(
        {
            serviceContext: getServiceContext(),
            inihibitDiagnosticMessage: Boolean(process.env.VITEST)
        },
        {
            level: process.env.LOG_LEVEL || 'info'
        }
    );

    const transport = getProductionTransport();

    return transport ? {...config, transport} : config;
}
