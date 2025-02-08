const factoriesController = require("../../controllers/factory/factory.controller");
const authenticate = require("../../middlewares/authenticate.middleware");
const checkRole = require("../../middlewares/checkRole.middleware");

module.exports = ({ app }) => {
  // Create a new factory
  app.post('/api/v1/factories/', { preHandler: [authenticate] }, (req, reply) => {
    factoriesController.createFactory(req, reply);
  });

  // Get all factories
  app.get('/api/v1/factories/', { preHandler: [authenticate] }, (req, reply) => {
    factoriesController.getFactories(req, reply);
  });

  // Get a specific factory by ID
  app.get('/api/v1/factory/', { preHandler: [authenticate] }, (req, reply) => {
    factoriesController.getFactoryById(req, reply);
  });

  // Update an existing factory (with role check)
  app.put('/api/v1/factories/:factoryId', { preHandler: [authenticate, checkRole] }, (req, reply) => {
    factoriesController.updateFactory(req, reply);
  });

  // Deactivate a factory (with role check)
  app.delete('/api/v1/factories/:factoryId', { preHandler: [authenticate, checkRole] }, (req, reply) => {
    factoriesController.deactivateFactory(req, reply);
  });
};