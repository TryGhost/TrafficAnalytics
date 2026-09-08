import bearerAuthPlugin from '@fastify/bearer-auth';
import type {FastifyInstance} from 'fastify';
import ndjsonPlugin from '../../plugins/ndjson';
import {dataValidatorCompiler, TinybirdSyncRequestBodySchema, type ZodTypeProvider} from '../../schemas';

async function tinybirdSyncRoutes(fastify: FastifyInstance) {
    const auth = process.env.TINYBIRD_SYNC_AUTH;

    fastify.setValidatorCompiler(dataValidatorCompiler);
    await fastify.register(ndjsonPlugin);

    await fastify.register(bearerAuthPlugin, {
        keys: new Set(auth ? [auth] : [])
    });

    fastify.withTypeProvider<ZodTypeProvider>().post('/', {
        bodyLimit: 10 * 1024 * 1024,
        onRequest: async (request, reply) => {
            const contentType = request.headers['content-type']?.split(';', 1)[0].trim().toLowerCase();
            if (contentType !== 'application/x-ndjson') {
                return reply.status(415).send({
                    error: 'Unsupported Media Type',
                    message: 'Content-Type must be application/x-ndjson'
                });
            }
        },
        schema: {
            body: TinybirdSyncRequestBodySchema
        }
    }, async (_request, reply) => reply.status(202).send());
}

export default tinybirdSyncRoutes;
