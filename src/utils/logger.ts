import pino from 'pino';
import type {LoggerOptions} from 'pino';
import type {PrettyOptions} from 'pino-pretty';
import type {FastifyRequest, FastifyReply} from 'fastify';

/**
 * Get logger configuration based on environment
 */
export function getLoggerConfig(): LoggerOptions | false {
    // Disable logging in test environment
    if (process.env.NODE_ENV === 'testing') {
        return false;
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