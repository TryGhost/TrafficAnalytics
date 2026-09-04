import {FastifyInstance} from 'fastify';
import {automationRouteOptions} from '../../handlers/automation-handlers';
import {dataValidatorCompiler, type ZodTypeProvider} from '../../schemas';

class InvalidNDJSONError extends Error {
    statusCode = 400;
}

const parseNDJSON = (body: string | Buffer): unknown[] => {
    return body
        .toString()
        .split('\n')
        .map((line, index) => ({value: line.trim(), lineNumber: index + 1}))
        .filter(line => Boolean(line.value))
        .map(({value, lineNumber}) => {
            try {
                return JSON.parse(value);
            } catch (err) {
                throw new InvalidNDJSONError(`Invalid JSON on line ${lineNumber}`, {cause: err});
            }
        });
};

async function automationsRoutes(fastify: FastifyInstance) {
    fastify.setValidatorCompiler(dataValidatorCompiler);

    fastify.addContentTypeParser('application/x-ndjson', {parseAs: 'string'}, (_request, body, done) => {
        try {
            done(null, parseNDJSON(body));
        } catch (err) {
            done(err instanceof Error ? err : new InvalidNDJSONError('Invalid NDJSON payload'));
        }
    });

    fastify.withTypeProvider<ZodTypeProvider>().post('/', automationRouteOptions);
}

export default automationsRoutes;
