import {FastifyInstance, FastifyRequest} from 'fastify';
import fp from 'fastify-plugin';
import split from 'split2';
import {IncomingMessage} from 'node:http';
import {pipeline} from 'node:stream/promises';
import type {JsonValue} from 'type-fest';

type NdjsonParseError = SyntaxError & {
    statusCode: number;
};

function parseError(lineNumber: number): NdjsonParseError {
    const error = new SyntaxError(`Invalid NDJSON on line ${lineNumber}`) as NdjsonParseError;
    error.statusCode = 400;
    return error;
}

function ndjsonPlugin(fastify: FastifyInstance) {
    fastify.addContentTypeParser('application/x-ndjson', async (_request: FastifyRequest, payload: IncomingMessage) => {
        const values: JsonValue[] = [];
        let lineNumber = 0;

        await pipeline(
            payload,
            split(),
            async (stream) => {
                for await (const value of stream) {
                    lineNumber += 1;

                    const line = String(value);

                    if (line.trim() === '') {
                        continue;
                    }

                    try {
                        values.push(JSON.parse(line));
                    } catch {
                        throw parseError(lineNumber);
                    }
                }
            }
        );

        return values;
    });
}

export default fp(ndjsonPlugin, {
    name: 'ndjson'
});
