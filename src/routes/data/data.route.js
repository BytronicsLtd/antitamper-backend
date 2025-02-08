const dataController = require("../../controllers/data/data.controller");
const authenticate = require("../../middlewares/authenticate.middleware");
const checkRole = require("../../middlewares/checkRole.middleware");

module.exports = ({ app }) => {
    // 
    app.get('/api/v1/data/', { preHandler: [authenticate,] }, (req, res) => {
      dataController.fetchMany(req,res);
    });
    // 
    app.post('/api/v1/data/', { preHandler: [authenticate,] }, (req, res) => {
      dataController.updateScaleStatus(req, res)
    });
  
  }