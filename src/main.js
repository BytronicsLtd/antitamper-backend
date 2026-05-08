const dotenv = require('dotenv');
dotenv.config();

const fastify = require('fastify');
const cors = require('@fastify/cors');

const isDev = !!process.env.DEV;
const app = fastify({
    logger: {
        level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
        ...(isDev && {
            transport: {
                target: 'pino-pretty',
                options: { translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname' },
            },
        }),
    },
    // We log requests ourselves below so we can skip CORS preflights (OPTIONS).
    disableRequestLogging: true,
    genReqId: () => `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
});

// Custom request logger — logs real API calls but ignores OPTIONS preflights.
if (process.env.LOG_ROUTES) {
    app.addHook('onRequest', async (req) => {
        if (req.method === 'OPTIONS') return;
        req.log.info({
            reqId: req.id,
            req: {
                method: req.method,
                url: req.url,
                host: req.headers.host,
                remoteAddress: req.ip,
            },
        }, 'incoming request');
    });
    app.addHook('onResponse', async (req, reply) => {
        if (req.method === 'OPTIONS') return;
        req.log.info({
            reqId: req.id,
            res: { statusCode: reply.statusCode },
            responseTime: reply.elapsedTime,
        }, 'request completed');
    });
}

// CORS — in dev (DEV=true) we reflect any origin so local UIs on arbitrary
// ports/hosts just work. In prod we honor the CORS_ORIGINS allowlist.
const corsOrigins = isDev
    ? true
    : (process.env.CORS_ORIGINS ||
        'https://iot.bytronics.io,https://api.bytronics.io,http://localhost:5173,http://localhost:5174'
      ).split(',').map((s) => s.trim()).filter(Boolean);
app.register(cors, {
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

// File upload
app.register(require('@fastify/multipart'), {
    limits: { fileSize: 1000000000 } // 1GB
});

// Encrypted M2M content-type parser
app.addContentTypeParser(
    'application/x-bytronics-encrypted',
    { parseAs: 'string' },
    (req, body, done) => {
        done(null, body);
    }
);

// OpenAPI / Swagger
app.register(require('@fastify/swagger'), {
    openapi: {
        info: {
            title: 'Bytronics Anti-Tamper API',
            description: 'Backend API for PDA registration, device validation, and factory management.',
            version: '1.0.0',
        },
        servers: [
            { url: process.env.API_BASE_URL || 'http://localhost:4000/api/v1' },
        ],
        components: {
            securitySchemes: {
                bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            },
        },
    },
});

app.register(require('@fastify/swagger-ui'), {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
});

// DB + MQTT
const dbConnect = require('./config/db.config.js');
if (process.env.MQTT_HOST) setupMQTT();
dbConnect();
require('./models/index');

// Route discovery
const all_routes = [];
app.addHook('onRoute', (route) => {
    const allowed = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    for (const m of methods) {
        if (allowed.includes(String(m).toUpperCase())) {
            all_routes.push({ method: m, url: route.url });
        }
    }
});

// Fastify's pino logger handles per-request access logs when LOG_ROUTES is set.

// Centralised error handler — produces a consistent JSON shape for any thrown
// or validation error. Existing controllers that respond with res.status().send()
// are unaffected; this only fires for uncaught throws.
app.setErrorHandler((err, req, reply) => {
    const status = err.statusCode || 500;
    if (status >= 500) {
        req.log.error({ err, reqId: req.id }, 'request failed');
    } else {
        req.log.warn({ err: err.message, reqId: req.id }, 'request rejected');
    }
    reply.status(status).send({
        success: false,
        message: err.message || 'Internal Server Error',
        code: err.code,
        validation: err.validation,
        requestId: req.id,
    });
});

// Wrap route registration in a plugin so it runs AFTER swagger has been initialised
// (Fastify processes registered plugins in order).
app.register(async (instance) => {
    require('./routes/index.js')({ app: instance });
});

async function main() {
    const port = process.env.PORT || 3001;
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`OpenAPI docs at http://localhost:${port}/docs`);

    const { setRoutes } = require('./globals/variables.globals.js');
    setRoutes(all_routes);
    if (process.env.LOG_ROUTES) app.log.debug({ routes: all_routes }, 'registered routes');
}

main().catch((err) => {
    app.log.error(err);
    process.exit(1);
});

function setupMQTT() {
    const mqtt = require('./config/mqtt.conf.js');
    const mqtt_instance = new mqtt({
        topic: '#',
        host: process.env.MQTT_HOST,
        port: process.env.MQTT_PORT,
        custom_name: process.env.MQTT_CUSTOM_NAME,
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
    });
    mqtt_instance.connect();
    mqtt_instance.onMessage((topic, message) => {
        if (topic === 'scale-antitamper/data') {
            app.log.info({ topic, message: JSON.parse(message) }, 'mqtt message');
        }
    });
}
