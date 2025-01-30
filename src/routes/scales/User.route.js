const userController = require("../../controllers/user/userController");
const authenticate = require("../../middlewares/authenticate.middleware");
const checkRole = require("../../middlewares/checkRole.middleware");

module.exports = ({ app }) => {
  app.post('/api/v1/users', { preHandler: [authenticate, checkRole] }, (req, res) => {
    userController.createUser(req, res);
  });

  app.get('/api/v1/users', { preHandler: [authenticate] }, (req, res) => {
    userController.getUsers(req, res);
  });

  app.get('/api/v1/users/:userId', { preHandler: [authenticate] }, (req, res) => {
    userController.getUserById(req, res);
  });

  app.put('/api/v1/users/:userId', { preHandler: [authenticate, checkRole] }, (req, res) => {
    userController.updateUser(req, res);
  });

  app.delete('/api/v1/users/:userId', { preHandler: [authenticate, checkRole] }, (req, res) => {
    userController.deleteUser(req, res);
  });

  app.post('/api/v1/login', (req, res) => {
    userController.userLogin(req, res);
  });
};
