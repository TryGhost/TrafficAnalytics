import {FastifyRequest as FastifyRequestBase, FastifyReply as FastifyReplyBase} from 'fastify';

export interface Payload {
    'user-agent': string;
    locale: string;
    location: string | null;
    referrer: string | null;
    parsedReferrer?: {
        source: string | null;
        medium: string | null;
        url: string | null;
    };
    pathname: string;
    href: string;
    site_uuid: string;
    post_uuid: string;
    post_type: string;
    member_uuid: string;
    member_status: string;
    os?: string;
    browser?: string;
    device?: string;
    user_signature?: string;
    meta?: {
        referrerUrl?: string;
        referrerSource?: string;
        referrerMedium?: string;
        userSignature?: string;
        [key: string]: unknown;
    };
}

export interface RequestBody {
    timestamp: string;
    action: string;
    version: string;
    session_id?: string;
    payload: Payload;
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
