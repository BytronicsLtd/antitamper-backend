const deviceController = require("../../controllers/devices/devices.controller");
const authenticate = require("../../middlewares/authenticate.middleware");
const checkRole = require("../../middlewares/checkRole.middleware");

module.exports = ({ app }) => {
  // create device
  app.post('/api/v1/devices/', { preHandler: [authenticate,checkRole(["root", "sys-admin"])] }, (req, res) => {
    deviceController.create(req, res)
  });
  // fetch many devices
  app.get('/api/v1/devices/', { preHandler: [authenticate,] }, (req, res) => {
    deviceController.fetchMany(req, res);
  });
  // fetch device details
  app.get('/api/v1/devices/details/', { preHandler: [authenticate,] }, (req, res) => {
    deviceController.getOne(req, res);
  });

  // fetch device details
  app.patch('/api/v1/devices/update/', { preHandler: [authenticate,checkRole(["root", "sys-admin"])] }, (req, res) => {
    deviceController.update(req, res);
  });
  // fetch device details
  app.delete('/api/v1/devices/remove/', { preHandler: [authenticate, checkRole(["root", "sys-admin"])] }, (req, res) => {
    deviceController.remove(req, res);
  });


}