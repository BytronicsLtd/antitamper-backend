const processResponse = require("../utils/processResponse");

const checkRole = (roles) => {
    return async function (req, res) {
        const role_exists = roles.some(role => req.user.roles.includes(role));
        if (!role_exists) {
            processResponse({
                req, res, success: false, status: 403,
                message: {
                    en: "You do not have permission to access this resource",
                }
            })
        }
    };
}
module.exports = checkRole;