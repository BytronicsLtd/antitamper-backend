const factoriesController = require("../../controllers/factory/factory.controller");
const authenticate = require("../../middlewares/authenticate.middleware");
const checkRole = require("../../middlewares/checkRole.middleware");

module.exports = ({ app }) => {
  // Create a new factory
  app.post('/api/v1/factories/', { preHandler: [authenticate, checkRole(['sys-admin'])] }, (req,res) => {
    factoriesController.createFactory(req,res);
  });

  // Get all factories
  app.get('/api/v1/factories/', { preHandler: [authenticate] }, (req,res) => {
    factoriesController.getFactories(req,res);
  });

  // Get a specific factory by ID
  app.get('/api/v1/factories/details/', { preHandler: [authenticate,] }, (req,res) => {
    factoriesController.getFactoryById(req,res);
  });

  // Update an existing factory 
  app.patch('/api/v1/factories/update/', { preHandler: [authenticate,checkRole(['sys-admin'])] }, (req,res) => {
    factoriesController.updateFactory(req,res);
  });

  // Deactivate a factory (with role check)
  app.delete('/api/v1/factories/remove/', { preHandler: [authenticate, checkRole(['sys-admin'])] }, (req,res) => {
    factoriesController.remove(req,res);
  });
};