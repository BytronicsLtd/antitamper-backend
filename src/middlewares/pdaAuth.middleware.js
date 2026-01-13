const PDAModel = require("../models/pda.model");

/**
 * PDA Authentication Middleware
 * Validates API key from X-PDA-API-Key header
 * Sets req.pda with PDA details if valid
 */
const pdaAuth = async (request, reply) => {
    try {
        const apiKey = request.headers['x-pda-api-key'];

        if (!apiKey) {
            return reply.status(401).send({
                success: false,
                message: "API key required"
            });
        }

        // Verify API key format and signature
        const payload = PDAModel.verifyApiKey(apiKey);

        if (!payload) {
            return reply.status(401).send({
                success: false,
                message: "Invalid API key"
            });
        }

        // Find PDA and verify it's approved with matching key
        const pda = await PDAModel.findById(payload.pda).select('+api_key');

        if (!pda) {
            return reply.status(401).send({
                success: false,
                message: "PDA not found"
            });
        }

        if (pda.status !== 'approved') {
            return reply.status(401).send({
                success: false,
                status: pda.status,
                message: pda.status === 'staging' ? "PDA pending approval" : "PDA is disabled"
            });
        }

        if (pda.api_key !== apiKey) {
            return reply.status(401).send({
                success: false,
                message: "API key mismatch - please re-authenticate"
            });
        }

        // Attach PDA to request
        request.pda = pda;

    } catch (error) {
        console.error("PDA Auth Error:", error);
        return reply.status(500).send({
            success: false,
            message: "Authentication error"
        });
    }
};

/**
 * Optional PDA Auth - doesn't fail if no key, just sets req.pda if valid
 * Also sets req.pdaKeyInvalid if a key was provided but is invalid
 */
const optionalPdaAuth = async (request, reply) => {
    try {
        const apiKey = request.headers['x-pda-api-key'];

        if (!apiKey) {
            request.pda = null;
            request.pdaKeyProvided = false;
            request.pdaKeyInvalid = false;
            return;
        }

        request.pdaKeyProvided = true;

        const payload = PDAModel.verifyApiKey(apiKey);

        if (!payload) {
            request.pda = null;
            request.pdaKeyInvalid = true;
            request.pdaKeyInvalidReason = 'Invalid key format or signature';
            return;
        }

        const pda = await PDAModel.findById(payload.pda).select('+api_key');

        if (!pda) {
            request.pda = null;
            request.pdaKeyInvalid = true;
            request.pdaKeyInvalidReason = 'PDA not found';
            return;
        }

        if (pda.status !== 'approved') {
            request.pda = null;
            request.pdaKeyInvalid = true;
            request.pdaKeyInvalidReason = pda.status === 'staging' ? 'PDA pending approval' : 'PDA is disabled';
            return;
        }

        if (pda.api_key !== apiKey) {
            request.pda = null;
            request.pdaKeyInvalid = true;
            request.pdaKeyInvalidReason = 'API key mismatch - key may have been revoked';
            return;
        }

        // Valid key
        request.pda = pda;
        request.pdaKeyInvalid = false;

    } catch (error) {
        console.error("Optional PDA Auth Error:", error);
        request.pda = null;
        request.pdaKeyInvalid = true;
        request.pdaKeyInvalidReason = 'Authentication error';
    }
};

module.exports = { pdaAuth, optionalPdaAuth };
