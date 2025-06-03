import Fastify, {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';

type TargetRequest = {
    method: string;
    url: string;
    query: Record<string, string>;
    headers: Record<string, string>;
    body: Record<string, unknown>;
};

function createMockUpstream(targetRequests: TargetRequest[]): FastifyInstance {
    const server = Fastify();
    
    server.all('*', async (req: FastifyRequest, reply: FastifyReply) => {
        if (req.headers['x-test-header-400']) {
            reply.code(400).send({error: 'Bad Request'});
            return;
        }
        
        targetRequests.push({
            method: req.method,
            url: req.url,
            query: req.query as Record<string, string>,
            headers: req.headers as Record<string, string>,
            body: req.body as Record<string, unknown>
        });
        
        reply.code(202).send({successful_rows: 1, quarantined_rows: 0});
    });

    return server;
}

export default createMockUpstream; 