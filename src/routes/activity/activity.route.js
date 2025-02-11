const activityLogsController = require("../../controllers/activity/Logs.controller");
const authenticate = require("../../middlewares/authenticate.middleware");
const checkRole = require("../../middlewares/checkRole.middleware");

module.exports = ({ app }) => {
  //
  app.get('/api/v1/activity-logs/', { preHandler: [authenticate, checkRole(['sys-admin'])] }, (req, res) => {
    activityLogsController.getAllActivityLogs(req, res);
  });
  //
  app.get('/api/v1/activity-logs/details/', { preHandler: [authenticate, checkRole(['sys-admin'])] }, (req, res) => {
    activityLogsController.getActivityLogById(req, res);
  });
  //
  app.delete('/api/v1/activity-logs/delete-old', { preHandler: [authenticate, checkRole(['sys-admin'])] }, (req, res) => {
    activityLogsController.deleteOldLogs(req, res);
  });
};
