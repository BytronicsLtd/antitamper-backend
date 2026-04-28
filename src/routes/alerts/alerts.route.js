const alertsController = require("../../controllers/alerts/alerts.controller");
const authenticate = require("../../middlewares/authenticate.middleware");
const checkRole = require("../../middlewares/checkRole.middleware");

module.exports = ({ app }) => {
  const guard = { preHandler: [authenticate, checkRole(['sys-admin'])] };

  app.get('/api/v1/alerts/', guard, (req, res) => alertsController.getAlerts(req, res));
  app.get('/api/v1/alerts/details/', guard, (req, res) => alertsController.getDetail(req, res));

  // Per-user read tracking
  app.get('/api/v1/alerts/unread-count/', guard, (req, res) => alertsController.unreadCount(req, res));
  app.post('/api/v1/alerts/mark-read/', guard, (req, res) => alertsController.markManyRead(req, res));
  app.post('/api/v1/alerts/:id/read/', guard, (req, res) => alertsController.markRead(req, res));
  app.post('/api/v1/alerts/:id/unread/', guard, (req, res) => alertsController.markUnread(req, res));
};
