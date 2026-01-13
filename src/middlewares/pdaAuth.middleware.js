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
 */
const optionalPdaAuth = async (request, reply) => {
    try {
        const apiKey = request.headers['x-pda-api-key'];

        if (!apiKey) {
            request.pda = null;
            return;
        }

        const payload = PDAModel.verifyApiKey(apiKey);

        if (!payload) {
            request.pda = null;
            return;
        }

        const pda = await PDAModel.findById(payload.pda).select('+api_key');

        if (pda && pda.status === 'approved' && pda.api_key === apiKey) {
            request.pda = pda;
        } else {
            request.pda = null;
        }

    } catch (error) {
        console.error("Optional PDA Auth Error:", error);
        request.pda = null;
    }
};

module.exports = { pdaAuth, optionalPdaAuth };
