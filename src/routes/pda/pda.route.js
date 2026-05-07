const pdaController = require("../../controllers/pda/pda.controller");
const authenticate = require("../../middlewares/authenticate.middleware");
const checkRole = require("../../middlewares/checkRole.middleware");
const { pdaAuth } = require("../../middlewares/pdaAuth.middleware");
const { m2mCrypto } = require("../../middlewares/m2mCrypto.middleware");
const schemas = require("./pda.schema");

const adminRoles = ["root", "sys-admin", "admin", "Manager"];

module.exports = ({ app }) => {
    // ---------- M2M (SDK <-> backend) ----------

    app.get('/api/v1/pda/:serial/status', {
        schema: schemas.getStatus,
        preHandler: [m2mCrypto],
    }, (req, res) => pdaController.getStatus(req, res));

    app.get('/api/v1/pda/:serial/devices', {
        schema: schemas.getDevices,
        preHandler: [m2mCrypto, pdaAuth],
    }, (req, res) => pdaController.getDevices(req, res));

    app.post('/api/v1/pda/sync/unregistered-attempts', {
        schema: schemas.syncUnregisteredAttempts,
        preHandler: [m2mCrypto, pdaAuth],
    }, (req, res) => pdaController.syncUnregisteredAttempts(req, res));

    // ---------- User-driven registration (PDA app <-> backend) ----------

    app.post('/api/v1/pda/register', {
        schema: schemas.register,
        preHandler: [authenticate],
    }, (req, res) => pdaController.register(req, res));

    // ---------- Admin (dashboard <-> backend) ----------

    app.get('/api/v1/pda/', {
        schema: schemas.fetchMany,
        preHandler: [authenticate],
    }, (req, res) => pdaController.fetchMany(req, res));

    app.get('/api/v1/pda/unregistered-attempts', {
        schema: schemas.getUnregisteredAttempts,
        preHandler: [authenticate],
    }, (req, res) => pdaController.getUnregisteredAttempts(req, res));

    app.post('/api/v1/pda/:serial/approve', {
        schema: schemas.approve,
        preHandler: [authenticate, checkRole(adminRoles)],
    }, (req, res) => pdaController.approve(req, res));

    app.post('/api/v1/pda/:serial/disable', {
        schema: schemas.disable,
        preHandler: [authenticate, checkRole(adminRoles)],
    }, (req, res) => pdaController.disable(req, res));

    app.post('/api/v1/pda/:serial/enable', {
        schema: schemas.enable,
        preHandler: [authenticate, checkRole(adminRoles)],
    }, (req, res) => pdaController.enable(req, res));

    app.post('/api/v1/pda/:serial/unapprove', {
        schema: schemas.unapprove,
        preHandler: [authenticate, checkRole(adminRoles)],
    }, (req, res) => pdaController.unapprove(req, res));

    app.delete('/api/v1/pda/:serial', {
        schema: schemas.deletePda,
        preHandler: [authenticate, checkRole(adminRoles)],
    }, (req, res) => pdaController.delete(req, res));
};
