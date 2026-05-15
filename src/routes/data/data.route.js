const dataController = require("../../controllers/data/data.controller");
const alertsController = require("../../controllers/data/alerts.controller");
const newRecordsController = require("../../controllers/data/newRecord.controller");
const authenticate = require("../../middlewares/authenticate.middleware");
const checkRole = require("../../middlewares/checkRole.middleware");

module.exports = ({ app }) => {
    // route used my m2m to update alerts
    app.post('/api/v1/data/', { preHandler: [] }, (req, res) => {
      newRecordsController.updateScaleStatus(req, res)
    });
    // 
    app.get('/api/v1/data/', { preHandler: [authenticate] }, (req, res) => {
      dataController.fetchMany(req,res);
    });
    // one row per device — the most recent reading. Same filter surface as /data/.
    app.get('/api/v1/data/latest/', { preHandler: [authenticate] }, (req, res) => {
      dataController.fetchLatest(req,res);
    });
    //
    app.get('/api/v1/data/raw/', { preHandler: [authenticate,checkRole(['root','sys-admin'])] }, (req, res) => {
      dataController.fetchManyRaw(req,res);
    });
    // 
    app.get('/api/v1/data/alerts/', { preHandler: [authenticate] }, (req, res) => {
      alertsController.fetchMany(req,res);
    });
    // Per-user read tracking for the Data Alerts surface
    app.get('/api/v1/data/alerts/unread-count/', { preHandler: [authenticate] }, (req, res) => {
      alertsController.unreadCount(req,res);
    });
    app.post('/api/v1/data/alerts/mark-read/', { preHandler: [authenticate] }, (req, res) => {
      alertsController.markManyRead(req,res);
    });
    app.post('/api/v1/data/alerts/mark-all-read/', { preHandler: [authenticate] }, (req, res) => {
      alertsController.markAllRead(req,res);
    });
    app.post('/api/v1/data/alerts/mark-all-unread/', { preHandler: [authenticate] }, (req, res) => {
      alertsController.markAllUnread(req,res);
    });
    app.post('/api/v1/data/alerts/:id/read/', { preHandler: [authenticate] }, (req, res) => {
      alertsController.markRead(req,res);
    });
    app.post('/api/v1/data/alerts/:id/unread/', { preHandler: [authenticate] }, (req, res) => {
      alertsController.markUnread(req,res);
    });
    // 
    app.get('/api/v1/data/details/', { preHandler: [authenticate] }, (req, res) => {
      dataController.fetchOne(req,res);
    });

  }