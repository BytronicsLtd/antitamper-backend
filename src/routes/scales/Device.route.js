const scalesController = require("../../controllers/scales/devices.controller");
const authenticate = require("../../middlewares/authenticate.middleware");
const checkRole = require("../../middlewares/checkRole.middleware");

module.exports = ({ app }) => {
    // 
    app.get('/api/v1/devices/', { preHandler: [authenticate,] }, (req, res) => {
      scalesController.fetchMany(req,res);
    });
    // 
    app.post('/api/v1/scales/', { preHandler: [authenticate,] }, (req, res) => {
      scalesController.updateScaleStatus(req, res)
    });
  
  }