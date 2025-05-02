// 
const authenticate = require("../../middlewares/authenticate.middleware");
const checkRole = require("../../middlewares/checkRole.middleware");

const regions = require("./regions.json")
module.exports = ({ app }) => {
    // fetch regions
    app.get("/api/v1/regions/", { preHandler: [authenticate, checkRole(['root', 'sys-admin'])] }, (req, res) => {
        res.status(200).send({ success: true, results: regions });
    });
}