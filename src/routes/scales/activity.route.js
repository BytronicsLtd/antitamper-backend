const activityLogsController = require("../../controllers/activity-logs/activityLogs.controller");
const authenticate = require("../../middlewares/authenticate.middleware");
const checkRole = require("../../middlewares/checkRole.middleware");

module.exports = ({ app }) => {
  app.post('/api/v1/activity-logs', { preHandler: [authenticate] }, (req, res) => {
    activityLogsController.logActivity(req, res);
  });

  app.get('/api/v1/activity-logs', { preHandler: [authenticate] }, (req, res) => {
    activityLogsController.getAllActivityLogs(req, res);
  });

  app.get('/api/v1/activity-logs/user/:userId', { preHandler: [authenticate] }, (req, res) => {
    activityLogsController.getLogsByUserId(req, res);
  });

  app.get('/api/v1/activity-logs/entity/:entityType/:entityId', { preHandler: [authenticate] }, (req, res) => {
    activityLogsController.getLogsByEntity(req, res);
  });

  app.get('/api/v1/activity-logs/date-range', { preHandler: [authenticate] }, (req, res) => {
    activityLogsController.getLogsByDateRange(req, res);
  });

  app.get('/api/v1/activity-logs/:logId', { preHandler: [authenticate] }, (req, res) => {
    activityLogsController.getActivityLogById(req, res);
  });

  app.delete('/api/v1/activity-logs/delete-old', { preHandler: [authenticate, checkRole] }, (req, res) => {
    activityLogsController.deleteOldLogs(req, res);
  });
};
