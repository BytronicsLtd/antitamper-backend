const checkRole = (roles) => {
    return async function (req, res) {
        const role_exists = roles.some(role => req.user.roles.includes(role));
        if (!role_exists) {
            res.status(403).send({
                success: false,
                message: "You do not have permission to access this resource",

            })
        }
    };
}
module.exports = checkRole;