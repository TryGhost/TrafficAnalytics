import {FastifyRequest as FastifyRequestBase, FastifyReply as FastifyReplyBase} from 'fastify';

export interface PayloadMeta {
    os: string;
    browser: string;
    device: string;
}

export interface Payload {
    [key: string]: any;
    meta?: PayloadMeta;
}

export interface RequestBody {
    payload: Payload;
    [key: string]: any;
}

export interface FastifyRequest extends FastifyRequestBase {
    body: RequestBody;
    query: {
        token?: string;
        name?: string;
        [key: string]: string | undefined;
    };
}

export interface FastifyReply extends FastifyReplyBase {
    // Add any custom properties if needed
}

export interface HttpProxyRequest {
    url: string;
    headers: {
        'user-agent'?: string;
        [key: string]: string | undefined;
    };
    body: RequestBody;
    log: {
        error: (err: Error) => void;
        info: (message: string) => void;
    };
    query: {
        token?: string;
        name?: string;
        [key: string]: string | undefined;
    };
    method: string;
}
