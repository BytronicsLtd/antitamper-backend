const dataController = require("../../controllers/data/data.controller");
const alertsController = require("../../controllers/data/alerts.controller");
const newRecordsController = require("../../controllers/data/newRecord.controller");
const authenticate = require("../../middlewares/authenticate.middleware");
const checkRole = require("../../middlewares/checkRole.middleware");

module.exports = ({ app }) => {
    // route used my m2m to
    app.post('/api/v1/data/', { preHandler: [] }, (req, res) => {
      newRecordsController.updateScaleStatus(req, res)
    });
    // 
    app.get('/api/v1/data/', { preHandler: [authenticate] }, (req, res) => {
      dataController.fetchMany(req,res);
    });
    // 
    app.get('/api/v1/data/raw/', { preHandler: [authenticate,checkRole(['root','sys-admin'])] }, (req, res) => {
      dataController.fetchManyRaw(req,res);
    });
    // 
    app.get('/api/v1/data/alerts/', { preHandler: [authenticate] }, (req, res) => {
      alertsController.fetchMany(req,res);
    });
    // 
    app.get('/api/v1/data/details/', { preHandler: [authenticate] }, (req, res) => {
      dataController.fetchOne(req,res);
    });

  }