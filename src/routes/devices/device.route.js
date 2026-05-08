const deviceController = require("../../controllers/devices/devices.controller");
const authenticate = require("../../middlewares/authenticate.middleware");
const checkRole = require("../../middlewares/checkRole.middleware");
const { optionalPdaAuth } = require("../../middlewares/pdaAuth.middleware");
const { m2mCrypto } = require("../../middlewares/m2mCrypto.middleware");

module.exports = ({ app }) => {
  // create device
  app.post('/api/v1/devices/', { preHandler: [authenticate, checkRole(["sys-admin", "national-manager", "regional-manager", "factory-admin"])] }, (req, res) => {
    deviceController.create(req, res)
  });
  //  m2m get time - supports encrypted requests
  app.post('/api/v1/devices/m2m/time/', { preHandler: [m2mCrypto] }, (req, res) => {
    deviceController.getTime(req, res);
  });
  //  m2m get company ID - supports encrypted requests
  app.post('/api/v1/devices/m2m/id/', { preHandler: [m2mCrypto] }, (req, res) => {
    deviceController.getCompanyID(req, res);
  });
  //  m2m verify scale - optionalPdaAuth sets req.pda if valid key provided
  //  supports encrypted requests (m2mCrypto before optionalPdaAuth)
  app.post('/api/v1/devices/m2m/verify/', { preHandler: [m2mCrypto, optionalPdaAuth] }, (req, res) => {
    deviceController.verifyScale(req, res);
  });
  // fetch many devices
  app.get('/api/v1/devices/', { preHandler: [authenticate,] }, (req, res) => {
    deviceController.fetchMany(req, res);
  });

  // fetch device details
  app.get('/api/v1/devices/:id', { preHandler: [authenticate,] }, (req, res) => {
    deviceController.getOne(req, res);
  });

  // update device
  app.patch('/api/v1/devices/:id', { preHandler: [authenticate,checkRole(["root", "sys-admin"])] }, (req, res) => {
    deviceController.update(req, res);
  });

  // delete device
  app.delete('/api/v1/devices/:id', { preHandler: [authenticate, checkRole(["root", "sys-admin"])] }, (req, res) => {
    deviceController.remove(req, res);
  });


}