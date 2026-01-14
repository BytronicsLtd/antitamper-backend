/**
 * M2M Encryption Middleware
 *
 * Handles transparent encryption/decryption for SDK ↔ Backend communication.
 * - Decrypts incoming requests with Content-Type: application/x-bytronics-encrypted
 * - Encrypts responses if the request was encrypted
 * - REJECTS unencrypted requests when encryption is enabled (security enforcement)
 * - Falls back to normal JSON only when encryption is NOT configured (backward compatibility)
 */

const { encrypt, decrypt, isEnabled } = require('../utils/m2mCrypto.util');

const ENCRYPTED_CONTENT_TYPE = 'application/x-bytronics-encrypted';
const ENCRYPTION_VERSION_HEADER = 'x-encryption-version';
const CURRENT_VERSION = '1';

/**
 * Helper to setup response encryption
 */
const setupResponseEncryption = (request, reply) => {
    reply.header(ENCRYPTION_VERSION_HEADER, CURRENT_VERSION);

    const originalSend = reply.send.bind(reply);
    reply.send = (payload) => {
        if (payload !== null && typeof payload === 'object') {
            try {
                const encrypted = encrypt(payload);
                reply.type(ENCRYPTED_CONTENT_TYPE);
                return originalSend(encrypted);
            } catch (error) {
                console.error('[m2mCrypto] Encryption failed:', error.message);
                return originalSend(payload);
            }
        }
        return originalSend(payload);
    };
};

/**
 * Middleware to decrypt M2M requests and encrypt responses
 * When encryption is enabled, REQUIRES encrypted requests - rejects plain JSON
 * @param {FastifyRequest} request
 * @param {FastifyReply} reply
 */
const m2mCrypto = async (request, reply) => {
    // If encryption is not configured, allow all requests (backward compatibility)
    if (!isEnabled()) {
        return;
    }

    // GET requests don't have bodies - allow them through but encrypt response
    if (request.method === 'GET') {
        request.isEncrypted = true;
        setupResponseEncryption(request, reply);
        return;
    }

    const contentType = request.headers['content-type']?.split(';')[0]?.trim(); // Strip charset

    // Check if request is encrypted
    if (contentType === ENCRYPTED_CONTENT_TYPE) {
        try {
            // Get raw body as string (must be configured with addContentTypeParser)
            const encryptedBody = request.body;

            if (!encryptedBody) {
                return reply.status(400).send({
                    success: false,
                    message: 'Missing encrypted request body'
                });
            }

            // Decrypt and parse JSON
            request.body = decrypt(encryptedBody);
            request.isEncrypted = true;

        } catch (error) {
            console.error('[m2mCrypto] Decryption failed:', error.message);
            return reply.status(400).send({
                success: false,
                message: 'Failed to decrypt request',
                error: process.env.DEV === 'true' ? error.message : undefined
            });
        }
    } else {
        // Encryption is enabled but request is not encrypted - REJECT
        // This enforces that M2M endpoints require encryption when server has it configured
        return reply.status(403).send({
            success: false,
            message: 'Encryption required. Use Content-Type: application/x-bytronics-encrypted'
        });
    }

    // Hook to encrypt response
    setupResponseEncryption(request, reply);
};

/**
 * Optional M2M crypto - doesn't fail if decryption fails, just logs
 * Useful for endpoints that accept both encrypted and unencrypted requests
 */
const optionalM2mCrypto = async (request, reply) => {
    if (!isEnabled()) {
        return;
    }

    const contentType = request.headers['content-type']?.split(';')[0]?.trim(); // Strip charset

    if (contentType === ENCRYPTED_CONTENT_TYPE) {
        try {
            request.body = decrypt(request.body);
            request.isEncrypted = true;
        } catch (error) {
            console.warn('[m2mCrypto] Optional decryption failed:', error.message);
            // Continue without decryption
        }
    }

    // Setup response encryption if needed
    if (request.isEncrypted) {
        setupResponseEncryption(request, reply);
    }
};

module.exports = {
    m2mCrypto,
    optionalM2mCrypto,
    ENCRYPTED_CONTENT_TYPE,
    ENCRYPTION_VERSION_HEADER
};
