const pdaController = require("../../controllers/pda/pda.controller");
const authenticate = require("../../middlewares/authenticate.middleware");
const checkRole = require("../../middlewares/checkRole.middleware");
const { pdaAuth, optionalPdaAuth } = require("../../middlewares/pdaAuth.middleware");
const { m2mCrypto } = require("../../middlewares/m2mCrypto.middleware");

module.exports = ({ app }) => {
    // =====================================================
    // M2M ENDPOINTS (SDK to Backend communication)
    // Note: PDA registration is handled automatically in /devices/m2m/verify/
    // =====================================================

    /**
     * Get PDA status - Polling endpoint
     * Returns status and API key if approved
     * Supports encrypted requests (m2mCrypto)
     */
    app.get('/api/v1/pda/:serial/status', { preHandler: [m2mCrypto] }, (req, res) => {
        pdaController.getStatus(req, res);
    });

    /**
     * Get devices for PDA's factory
     * Requires valid API key
     * Supports encrypted requests (m2mCrypto before pdaAuth)
     */
    app.get('/api/v1/pda/:serial/devices', { preHandler: [m2mCrypto, pdaAuth] }, (req, res) => {
        pdaController.getDevices(req, res);
    });

    /**
     * Sync unregistered BT attempts from SDK
     * Requires valid API key
     * Supports encrypted requests (m2mCrypto before pdaAuth)
     */
    app.post('/api/v1/pda/sync/unregistered-attempts', { preHandler: [m2mCrypto, pdaAuth] }, (req, res) => {
        pdaController.syncUnregisteredAttempts(req, res);
    });

    // =====================================================
    // ADMIN ENDPOINTS (Dashboard to Backend)
    // =====================================================

    /**
     * Fetch all PDAs with pagination
     * Requires authentication
     */
    app.get('/api/v1/pda/', { preHandler: [authenticate] }, (req, res) => {
        pdaController.fetchMany(req, res);
    });

    /**
     * Approve PDA
     * Requires root or sys-admin role
     */
    app.post('/api/v1/pda/:serial/approve', {
        preHandler: [authenticate, checkRole(["root", "sys-admin", "admin", "Manager"])]
    }, (req, res) => {
        pdaController.approve(req, res);
    });

    /**
     * Disable PDA
     * Requires root or sys-admin role
     */
    app.post('/api/v1/pda/:serial/disable', {
        preHandler: [authenticate, checkRole(["root", "sys-admin", "admin", "Manager"])]
    }, (req, res) => {
        pdaController.disable(req, res);
    });

    /**
     * Enable (re-enable) disabled PDA
     * Requires root or sys-admin role
     */
    app.post('/api/v1/pda/:serial/enable', {
        preHandler: [authenticate, checkRole(["root", "sys-admin", "admin", "Manager"])]
    }, (req, res) => {
        pdaController.enable(req, res);
    });

    /**
     * Delete PDA (only staging)
     * Requires root or sys-admin role
     */
    app.delete('/api/v1/pda/:serial', {
        preHandler: [authenticate, checkRole(["root", "sys-admin", "admin", "Manager"])]
    }, (req, res) => {
        pdaController.delete(req, res);
    });

    /**
     * Unapprove/Decommission PDA (move approved back to staging)
     * Requires root or sys-admin role
     */
    app.post('/api/v1/pda/:serial/unapprove', {
        preHandler: [authenticate, checkRole(["root", "sys-admin", "admin", "Manager"])]
    }, (req, res) => {
        pdaController.unapprove(req, res);
    });

    /**
     * Get unregistered BT attempts report
     * Requires authentication
     */
    app.get('/api/v1/pda/unregistered-attempts', { preHandler: [authenticate] }, (req, res) => {
        pdaController.getUnregisteredAttempts(req, res);
    });
};
