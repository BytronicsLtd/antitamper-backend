const activityLogsController = require("../../controllers/scales/Logs.controller");
const authenticate = require("../../middlewares/authenticate.middleware");
const checkRole = require("../../middlewares/checkRole.middleware");

module.exports = ({ app }) => {
  app.post('/api/v1/activity-logs', (req, res) => {
    activityLogsController.logActivity(req, res);
  });

  app.get('/api/v1/activity-logs', (req, res) => {
    activityLogsController.getAllActivityLogs(req, res);
  });

  app.get('/api/v1/activity-logs/user/:userId', (req, res) => {
    activityLogsController.getLogsByUserId(req, res);
  });

  app.get('/api/v1/activity-logs/entity/:entityType/:entityId',  (req, res) => {
    activityLogsController.getLogsByEntity(req, res);
  });

  app.get('/api/v1/activity-logs/date-range',  (req, res) => {
    activityLogsController.getLogsByDateRange(req, res);
  });

  app.get('/api/v1/activity-logs/:logId', (req, res) => {
    activityLogsController.getActivityLogById(req, res);
  });

  app.delete('/api/v1/activity-logs/delete-old',  (req, res) => {
    activityLogsController.deleteOldLogs(req, res);
  });
};
