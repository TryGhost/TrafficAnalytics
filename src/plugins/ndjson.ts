import {errorCodes, FastifyInstance, FastifyRequest} from 'fastify';
import fp from 'fastify-plugin';
import {IncomingMessage} from 'node:http';
import {StringDecoder} from 'node:string_decoder';
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
    fastify.addContentTypeParser('application/x-ndjson', async (request: FastifyRequest, payload: IncomingMessage) => {
        const values: JsonValue[] = [];
        let lineNumber = 0;
        let receivedBytes = 0;
        let remainder = '';
        const decoder = new StringDecoder('utf8');

        const parseLine = (line: string) => {
            lineNumber += 1;

            if (line.trim() === '') {
                return;
            }

            try {
                values.push(JSON.parse(line));
            } catch {
                throw parseError(lineNumber);
            }
        };

        for await (const chunk of payload) {
            receivedBytes += chunk.length;
            if (receivedBytes > request.routeOptions.bodyLimit) {
                throw new errorCodes.FST_ERR_CTP_BODY_TOO_LARGE();
            }

            remainder += decoder.write(chunk);
            let newlineIndex = remainder.indexOf('\n');
            while (newlineIndex !== -1) {
                parseLine(remainder.slice(0, newlineIndex));
                remainder = remainder.slice(newlineIndex + 1);
                newlineIndex = remainder.indexOf('\n');
            }
        }

        remainder += decoder.end();
        if (remainder !== '') {
            parseLine(remainder);
        }

        return values;
    });
}

export default fp(ndjsonPlugin, {
    name: 'ndjson'
});
