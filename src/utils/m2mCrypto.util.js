/**
 * M2M Encryption Utility
 *
 * Provides AES-256-GCM encryption/decryption for SDK ↔ Backend communication.
 * Wire format: Base64(version[1] || nonce[12] || ciphertext || tag[16])
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const VERSION = 0x01;
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Get the encryption key from environment
 * @returns {Buffer} 32-byte key
 * @throws {Error} If key is missing or invalid
 */
const getKey = () => {
    const keyHex = process.env.M2M_ENCRYPTION_KEY;
    if (!keyHex || keyHex.length !== 64) {
        throw new Error('M2M_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    }
    return Buffer.from(keyHex, 'hex');
};

/**
 * Check if M2M encryption is enabled
 * @returns {boolean}
 */
const isEnabled = () => {
    return !!process.env.M2M_ENCRYPTION_KEY && process.env.M2M_ENCRYPTION_KEY.length === 64;
};

/**
 * Decrypt M2M payload
 * @param {string} base64Payload - Base64(version || nonce || ciphertext || tag)
 * @returns {object} Parsed JSON object
 * @throws {Error} If decryption fails or payload is invalid
 */
const decrypt = (base64Payload) => {
    if (!base64Payload || typeof base64Payload !== 'string') {
        throw new Error('Invalid encrypted payload: expected non-empty string');
    }

    const payload = Buffer.from(base64Payload, 'base64');

    // Minimum length: version(1) + nonce(12) + tag(16) + at least 1 byte ciphertext
    const minLength = 1 + NONCE_LENGTH + TAG_LENGTH + 1;
    if (payload.length < minLength) {
        throw new Error(`Invalid payload length: ${payload.length} bytes (minimum: ${minLength})`);
    }

    const version = payload[0];
    if (version !== VERSION) {
        throw new Error(`Unsupported encryption version: ${version} (expected: ${VERSION})`);
    }

    const nonce = payload.slice(1, 1 + NONCE_LENGTH);
    const tag = payload.slice(-TAG_LENGTH);
    const ciphertext = payload.slice(1 + NONCE_LENGTH, -TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), nonce);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
    ]);

    return JSON.parse(decrypted.toString('utf8'));
};

/**
 * Encrypt M2M response
 * @param {object} data - Object to encrypt
 * @returns {string} Base64 encoded encrypted payload
 */
const encrypt = (data) => {
    const nonce = crypto.randomBytes(NONCE_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), nonce);

    const plaintext = JSON.stringify(data);
    const ciphertext = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
    ]);
    const tag = cipher.getAuthTag();

    // Wire format: version(1) || nonce(12) || ciphertext || tag(16)
    const payload = Buffer.concat([
        Buffer.from([VERSION]),
        nonce,
        ciphertext,
        tag
    ]);

    return payload.toString('base64');
};

module.exports = {
    encrypt,
    decrypt,
    isEnabled,
    ALGORITHM,
    VERSION,
    NONCE_LENGTH,
    TAG_LENGTH
};
