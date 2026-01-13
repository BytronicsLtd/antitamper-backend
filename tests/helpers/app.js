const fastify = require('fastify');
const cors = require('@fastify/cors');

/**
 * Creates a Fastify app instance for testing
 */
async function buildApp() {
    const app = fastify({ logger: false });

    // Register cors
    await app.register(cors, {});

    // Register multipart (for file uploads)
    await app.register(require('@fastify/multipart'), {
        limits: { fileSize: 1000000000 }
    });

    // Register routes
    require('../../src/routes/index.js')({ app });

    return app;
}

module.exports = { buildApp };
