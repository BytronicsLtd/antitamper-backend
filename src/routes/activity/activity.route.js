const activityLogsController = require("../../controllers/activity/Logs.controller");
const authenticate = require("../../middlewares/authenticate.middleware");
const checkRole = require("../../middlewares/checkRole.middleware");

module.exports = ({ app }) => {
  //
  app.get('/api/v1/activity-logs/', (req, res) => {
    activityLogsController.getAllActivityLogs(req, res);
  });
  //
  app.get('/api/v1/activity-log/', (req, res) => {
    activityLogsController.getActivityLogById(req, res);
  });
  //
  app.delete('/api/v1/activity-logs/delete-old', (req, res) => {
    activityLogsController.deleteOldLogs(req, res);
  });
};
