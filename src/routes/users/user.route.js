const userController = require("../../controllers/user/user.controller");
const authController = require("../../controllers/user/auth.controller");
const passwordController = require("../../controllers/user/password.controller");
const authenticate = require("../../middlewares/authenticate.middleware");
const checkRole = require("../../middlewares/checkRole.middleware");

module.exports = ({ app }) => {
  // Create a new user  
  app.post('/api/v1/users/', { preHandler: [authenticate, checkRole(['root', 'sys-admin'])] }, (req, res) => {
    authController.createUser(req, res);
  });
  // login user
  app.post('/api/v1/users/login/', (req, res) => {
    authController.login(req, res);
  });
  // login user
  app.post('/api/v1/users/request-verification/', { preHandler: [] }, (req, res) => {
    authController.requestVerification(req, res)
  });
  // verify user
  app.post('/api/v1/users/verify/', (req, res) => {
    authController.verifyUser(req, res);
  });
  // request password rest
  app.post('/api/v1/users/request-password-reset/', (req, res) => {
    passwordController.requestReset(req, res);
  });
  // reset password
  app.post('/api/v1/users/reset-password/', (req, res) => {
    passwordController.resetPassword(req, res);
  });

  // logout
  app.post('/api/v1/users/logout/', { preHandler: [authenticate] }, (req, res) => {
    authController.logout(req, res)
  });
  // Retrieve all users
  app.get('/api/v1/users/', { preHandler: [authenticate, checkRole(['root', 'sys-admin', 'Manager', 'ICT Manager'])] }, (req, res) => {
    userController.getUsers(req, res);
  });

  // Retrieve a specific user by ID
  app.get('/api/v1/users/details/', { preHandler: [authenticate, checkRole(['root', 'sys-admin'])] }, (req, res) => {
    userController.getUserById(req, res);
  });
  // Retrieve login in user details
  app.get('/api/v1/users/me/', { preHandler: [authenticate,] }, (req, res) => {
    userController.getMe(req, res);
  });

  // Update a user by ID
  app.patch('/api/v1/users/update/', { preHandler: [authenticate,] }, (req, res) => {
    userController.updateUser(req, res);
  });

  // Delete a user by ID
  app.delete('/api/v1/users/remove/', { preHandler: [authenticate,] }, (req, res) => {
    userController.remove(req, res);
  });


};