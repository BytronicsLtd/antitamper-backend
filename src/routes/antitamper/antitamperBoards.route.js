const controller = require('../../controllers/antitamper/antitamperBoards.controller');
const authenticate = require('../../middlewares/authenticate.middleware');
const checkRole = require('../../middlewares/checkRole.middleware');

// SYSTEM-only: only sys-admin (and the internal "root" superuser) can touch
// the antitamper-boards catalog — both read and write.
const sysOnly = { preHandler: [authenticate, checkRole(['root', 'sys-admin'])] };

// The "available" route is the one exception — any user who can edit a
// scale needs to populate the board dropdown, so it's gated by
// authenticate only. The list returns minimal fields (no notes/audit).
const authOnly = { preHandler: [require('../../middlewares/authenticate.middleware')] };

module.exports = ({ app }) => {
  app.post('/api/v1/antitamper-boards/', sysOnly, (req, res) => controller.create(req, res));
  app.get('/api/v1/antitamper-boards/', sysOnly, (req, res) => controller.fetchMany(req, res));
  app.get('/api/v1/antitamper-boards/available/', authOnly, (req, res) => controller.available(req, res));
  app.get('/api/v1/antitamper-boards/:id', sysOnly, (req, res) => controller.getOne(req, res));
  app.patch('/api/v1/antitamper-boards/:id', sysOnly, (req, res) => controller.update(req, res));
  app.delete('/api/v1/antitamper-boards/:id', sysOnly, (req, res) => controller.remove(req, res));
};
