import pino from 'pino';
import type {LoggerOptions} from 'pino';
import type {PrettyOptions} from 'pino-pretty';
import type {FastifyRequest, FastifyReply} from 'fastify';
import config from '@tryghost/config';

/**
 * Get logger configuration based on environment
 */
export function getLoggerConfig(): LoggerOptions | false {
    // Disable logging in test environment
    if (config.get('NODE_ENV') as string === 'testing') {
        return false;
    }

    // Development configuration - simple pretty logs
    if (config.get('NODE_ENV') as string === 'development') {
        return {
            level: config.get('LOG_LEVEL') as string,
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

    // Production / staging configuration - full JSON logs
    return {
        level: process.env.LOG_LEVEL || 'info',
        messageKey: 'message',
        formatters: {
            level: (label) => {
                return {
                    severity: label.toUpperCase()
                };
            }
        }
    };
}

// Create the default logger instance
const logger = pino(getLoggerConfig() || {});

export default logger;