const factoriesController = require("../../controllers/factory/factory.controller");
const authenticate = require("../../middlewares/authenticate.middleware");
const checkRole = require("../../middlewares/checkRole.middleware");

module.exports = ({ app }) => {
  // Create a new factory
  app.post('/api/v1/factories/', { preHandler: [authenticate] }, (req,res) => {
    factoriesController.createFactory(req,res);
  });

  // Get all factories
  app.get('/api/v1/factories/', { preHandler: [authenticate] }, (req,res) => {
    factoriesController.getFactories(req,res);
  });

  // Get a specific factory by ID
  app.get('/api/v1/factory/', { preHandler: [authenticate,] }, (req,res) => {
    factoriesController.getFactoryById(req,res);
  });

  // Update an existing factory (with role check)
  app.put('/api/v1/factories/:factoryId', { preHandler: [authenticate] }, (req,res) => {
    factoriesController.updateFactory(req,res);
  });

  // Deactivate a factory (with role check)
  app.delete('/api/v1/factories/:factoryId', { preHandler: [authenticate] }, (req,res) => {
    factoriesController.deactivateFactory(req,res);
  });
};