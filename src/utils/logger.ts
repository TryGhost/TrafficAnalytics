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

    // Production configuration - full JSON logs
    if (process.env.NODE_ENV === 'production') {
        return {
            level: process.env.LOG_LEVEL || 'info',
            serializers: {
                req(request: FastifyRequest) {
                    return {
                        method: request.method,
                        url: request.url,
                        headers: request.headers,
                        hostname: request.hostname,
                        remoteAddress: request.ip,
                        remotePort: request.socket?.remotePort
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

    // Development configuration - simple pretty logs
    return {
        level: process.env.LOG_LEVEL || 'info',
        transport: {
            target: 'pino-pretty',
            options: {
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname,reqId,responseTime,req,res', // hides JSON object
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

// Create the default logger instance
const logger = pino(getLoggerConfig() || {});

export default logger;