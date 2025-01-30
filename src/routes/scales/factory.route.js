const factoriesController = require("../../controllers/factories/factories.controller");
const authenticate = require("../../middlewares/authenticate.middleware");
const checkRole = require("../../middlewares/checkRole.middleware");

module.exports = ({ app }) => {
  app.post('/api/v1/factories', { preHandler: [authenticate] }, (req, res) => {
    factoriesController.createFactory(req, res);
  });

  app.get('/api/v1/factories', { preHandler: [authenticate] }, (req, res) => {
    factoriesController.getFactories(req, res);
  });

  app.get('/api/v1/factories/:factoryId', { preHandler: [authenticate] }, (req, res) => {
    factoriesController.getFactoryById(req, res);
  });

  app.put('/api/v1/factories/:factoryId', { preHandler: [authenticate, checkRole] }, (req, res) => {
    factoriesController.updateFactory(req, res);
  });

  app.delete('/api/v1/factories/:factoryId', { preHandler: [authenticate, checkRole] }, (req, res) => {
    factoriesController.deactivateFactory(req, res);
  });
};
