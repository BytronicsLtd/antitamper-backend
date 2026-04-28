/**
 * JSON Schema definitions for PDA routes.
 * Used by Fastify for request validation and by @fastify/swagger for OpenAPI docs.
 */

const tags = ['pda'];
const security = [{ bearerAuth: [] }];

const serialParam = {
    type: 'object',
    required: ['serial'],
    properties: { serial: { type: 'string', minLength: 1 } },
};

const errorResponse = {
    type: 'object',
    properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        requestId: { type: 'string' },
    },
};

const paginationQuery = {
    type: 'object',
    properties: {
        page: { type: 'integer', minimum: 1, default: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 200, default: 20 },
        status: { type: 'string', enum: ['staging', 'approved', 'disabled'] },
    },
};

const unregisteredAttemptsBody = {
    type: 'object',
    required: ['attempts'],
    properties: {
        attempts: {
            type: 'array',
            items: {
                type: 'object',
                required: ['mac', 'timestamp'],
                properties: {
                    mac: { type: 'string', pattern: '^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$' },
                    name: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                    rssi: { type: 'integer' },
                },
                additionalProperties: true,
            },
        },
    },
};

module.exports = {
    getStatus: {
        tags,
        summary: 'PDA status (M2M, polling)',
        params: serialParam,
        response: { 4: errorResponse, 5: errorResponse },
    },
    getDevices: {
        tags,
        summary: 'Allowed devices for PDA factory (M2M)',
        params: serialParam,
        response: { 4: errorResponse, 5: errorResponse },
    },
    syncUnregisteredAttempts: {
        tags,
        summary: 'Sync unregistered BT attempts (M2M)',
        // NOTE: body validation intentionally omitted — payload arrives as
        // application/x-bytronics-encrypted (AES-GCM ciphertext) and is decrypted
        // in the m2mCrypto preHandler before the route body is populated.
        // Documented body shape after decryption:
        description: 'Body (decrypted): ' + JSON.stringify(unregisteredAttemptsBody),
        response: { 4: errorResponse, 5: errorResponse },
    },
    fetchMany: {
        tags,
        security,
        summary: 'List PDAs (paginated)',
        querystring: paginationQuery,
    },
    approve: {
        tags,
        security,
        summary: 'Approve a PDA',
        params: serialParam,
    },
    disable: {
        tags,
        security,
        summary: 'Disable a PDA',
        params: serialParam,
    },
    enable: {
        tags,
        security,
        summary: 'Re-enable a disabled PDA',
        params: serialParam,
    },
    deletePda: {
        tags,
        security,
        summary: 'Delete a staging PDA',
        params: serialParam,
    },
    unapprove: {
        tags,
        security,
        summary: 'Move approved PDA back to staging',
        params: serialParam,
    },
    getUnregisteredAttempts: {
        tags,
        security,
        summary: 'Unregistered BT attempts report',
        querystring: paginationQuery,
    },
};
