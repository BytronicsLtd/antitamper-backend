const userController = require("../../controllers/user/user.controller");
const authenticate = require("../../middlewares/authenticate.middleware");

module.exports = ({ app }) => {
  // Create a new user
  app.post('/api/v1/users/', (req,res) => {
    userController.createUser(req,res);
  });

  // Retrieve all users
  app.get('/api/v1/users/', (req,res) => {
    userController.getUsers(req,res);
  });

  // Retrieve a specific user by ID
  app.get('/api/v1/user/', (req,res) => {
    userController.getUserById(req,res);
  });

  // Update a user by ID
  app.put('/api/v1/users/:userId', (req,res) => {
    userController.updateUser(req,res);
  });

  // Delete a user by ID
  app.delete('/api/v1/users/:userId', (req,res) => {
    userController.deleteUser(req,res);
  });

  // User login (public route)
  app.post('/api/v1/login', (req,res) => {
    userController.userLogin(req,res);
  });
};