const factoriesController = require("../../controllers/factory/factory.controller");
const authenticate = require("../../middlewares/authenticate.middleware");
const checkRole = require("../../middlewares/checkRole.middleware");

// Roles permitted to mutate factories. Per-region scoping is enforced in
// the controller via canAccessRegion(); the role gate just rejects roles
// that have no factory write permission at all (viewers, factory-admin,
// etc — see src/lib/permissions matrix in the dashboard).
const factoryWriters = ['sys-admin', 'national-manager', 'regional-manager'];

module.exports = ({ app }) => {
  // Create a new factory
  app.post('/api/v1/factories/', { preHandler: [authenticate, checkRole(factoryWriters)] }, (req,res) => {
    factoriesController.createFactory(req,res);
  });

  // Get all factories
  app.get('/api/v1/factories/', { preHandler: [authenticate] }, (req,res) => {
    factoriesController.getFactories(req,res);
  });

  // Get a specific factory by ID
  app.get('/api/v1/factories/:id', { preHandler: [authenticate,] }, (req,res) => {
    factoriesController.getFactoryById(req,res);
  });

  // Update an existing factory
  app.patch('/api/v1/factories/:id', { preHandler: [authenticate, checkRole(factoryWriters)] }, (req,res) => {
    factoriesController.updateFactory(req,res);
  });

  // Deactivate a factory
  app.delete('/api/v1/factories/:id', { preHandler: [authenticate, checkRole(factoryWriters)] }, (req,res) => {
    factoriesController.remove(req,res);
  });
};