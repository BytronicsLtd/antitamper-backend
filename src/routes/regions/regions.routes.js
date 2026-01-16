const authenticate = require("../../middlewares/authenticate.middleware");
const checkRole = require("../../middlewares/checkRole.middleware");
const regionController = require("../../controllers/regions/regions.controller");

module.exports = ({ app }) => {
  // List all regions - available to all authenticated users (filtering handled in controller)
  app.get("/api/v1/regions/", {
    preHandler: [authenticate]
  }, regionController.getRegions);

  // Get region by ID
  app.get("/api/v1/regions/:id", {
    preHandler: [authenticate, checkRole(['root', 'sys-admin'])]
  }, regionController.getRegionById);

  // Create region - sys-admin only
  app.post("/api/v1/regions/", {
    preHandler: [authenticate, checkRole(['root', 'sys-admin'])]
  }, regionController.createRegion);

  // Update region - sys-admin only
  app.patch("/api/v1/regions/:id", {
    preHandler: [authenticate, checkRole(['root', 'sys-admin'])]
  }, regionController.updateRegion);

  // Delete region - sys-admin only
  app.delete("/api/v1/regions/:id", {
    preHandler: [authenticate, checkRole(['root', 'sys-admin'])]
  }, regionController.removeRegion);
};
