
const scalesController = require("../../controllers/scales/scales.controller");
const authenticate = require("../../middlewares/authenticate.middleware");
const checkRole = require("../../middlewares/checkRole.middleware")
module.exports = ({ app }) => {
 
 
  // fetch current user details
  app.get('/api/v1/scales/', { preHandler: [authenticate,] }, (req, res) => {
    scalesController.fetchMany(req,res);
  });
  // logout
  app.post('/api/v1/scales/', { preHandler: [authenticate,] }, (req, res) => {
    scalesController.create(req, res)
  });

}
