const Fastify = require('fastify');

function createMockUpstream(targetRequests) {
    const server = Fastify();
    server.all('*', async (req, reply) => {
        if (req.headers['x-test-header-400']) {
            reply.code(400).send({error: 'Bad Request'});
            return;
        }
        targetRequests.push({
            method: req.method,
            url: req.url,
            query: req.query,
            headers: req.headers,
            body: req.body
        });
        reply.code(202).send({successful_rows: 1,quarantined_rows: 0});
    });

    return server;
}

module.exports = createMockUpstream;
