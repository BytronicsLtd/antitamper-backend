const userController = require("../../controllers/scales/user.controller");
const authenticate = require("../../middlewares/authenticate.middleware");

module.exports = ({ app }) => {
  // Create a new user
  app.post('/api/v1/users/', (req, reply) => {
    userController.createUser(req, reply);
  });

  // Retrieve all users
  app.get('/api/v1/users', (req, reply) => {
    userController.getUsers(req, reply);
  });

  // Retrieve a specific user by ID
  app.get('/api/v1/users/:userId', (req, reply) => {
    userController.getUserById(req, reply);
  });

  // Update a user by ID
  app.put('/api/v1/users/:userId', (req, reply) => {
    userController.updateUser(req, reply);
  });

  // Delete a user by ID
  app.delete('/api/v1/users/:userId', (req, reply) => {
    userController.deleteUser(req, reply);
  });

  // User login (public route)
  app.post('/api/v1/login', (req, reply) => {
    userController.userLogin(req, reply);
  });
};