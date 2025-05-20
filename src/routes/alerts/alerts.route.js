const alertsController = require("../../controllers/alerts/alerts.controller");
const authenticate = require("../../middlewares/authenticate.middleware");
const checkRole = require("../../middlewares/checkRole.middleware");

module.exports = ({ app }) => {
  //checkRole([])
  app.get('/api/v1/alerts/', { preHandler: [authenticate, checkRole(['sys-admin'])] }, (req, res) => {
    alertsController.getAlerts(req, res);
  });
  //
  app.get('/api/v1/alerts/details/', { preHandler: [authenticate, checkRole(['sys-admin'])] }, (req, res) => {
    alertsController.getDetail(req, res);
  });
 
};
