const activityLogsController = require("../../controllers/activity/Logs.controller");
const authenticate = require("../../middlewares/authenticate.middleware");
const checkRole = require("../../middlewares/checkRole.middleware");

module.exports = ({ app }) => {
  // Open to any authenticated user. The controller scopes results based on
  // the caller's role: viewers see only their own activity; managers see
  // everyone in their scope (factory / region / org).
  app.get('/api/v1/activity-logs/', { preHandler: [authenticate] }, (req, res) => {
    activityLogsController.getAllActivityLogs(req, res);
  });
  //
  app.get('/api/v1/activity-logs/details/', { preHandler: [authenticate] }, (req, res) => {
    activityLogsController.getActivityLogById(req, res);
  });
  //
  app.delete('/api/v1/activity-logs/delete-old/', { preHandler: [authenticate, checkRole(['root'])] }, (req, res) => {
    activityLogsController.deleteOldLogs(req, res);
  });
};
