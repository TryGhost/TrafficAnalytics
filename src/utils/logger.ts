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
                        params: request.params,
                        query: request.query,
                        headers: {
                            host: request.headers.host,
                            'user-agent': request.headers['user-agent'],
                            'content-type': request.headers['content-type'],
                            'content-length': request.headers['content-length'],
                            referer: request.headers.referer,
                            'x-forwarded-for': request.headers['x-forwarded-for']
                        },
                        hostname: request.hostname,
                        remoteAddress: request.ip,
                        remotePort: request.socket?.remotePort,
                        id: request.id
                    };
                },
                res(reply: FastifyReply) {
                    return {
                        statusCode: reply.statusCode,
                        headers: reply.getHeaders()
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