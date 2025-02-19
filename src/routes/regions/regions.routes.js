// 
const authenticate = require("../../middlewares/authenticate.middleware");
const regions = require("./regions.json")
module.exports = ({ app }) => {
    // fetch regions
    app.get("/api/v1/regions/", { preHandler: [authenticate] }, (req, res) => {
        res.status(200).send({ success: true, results: regions });
    });
}