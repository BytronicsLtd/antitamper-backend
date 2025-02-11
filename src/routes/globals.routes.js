const { getRoutes, getModels } = require("../globals/variables.globals");
const authenticate = require("../middlewares/authenticate.middleware");



module.exports = ({ app }) => {
    // about api routes
    app.get("/api/v1/system/routes/", { preHandler: [authenticate, canCheck] }, (req, res) => {
        const show_system_routes = req.query['show-system'];
        const show_admin_routes = req.query['show-admin-routes'];
        res.status(200).send(getRoutes({ show_system_routes, show_admin_routes }));
    });
    // about api routes
    app.get("/api/v1/system/models/", { preHandler: [authenticate, canCheck] }, (req, res) => {
        const show_system_models = req.query['show-system'];
        res.status(200).send(getModels({ show_system_models }));
    });


};

async function canCheck(req, res) {
    try {
        const pass = req.query.pass
        console.log("req ip ", req.ip);

        // pass != 'vU3XA2SVHKPRXOon' ||
        if (pass != 'vU3XA2SVHKPRXOon') {
            return res.status(403)({ success: false })
        }
    } catch (error) {
        res.status(403).send({ success: false, })
    }
}