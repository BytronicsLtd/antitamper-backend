const processResponse = require("../utils/processResponse");

const authenticate = async (req, res) => {
    try {
       const ip =  req.ip;
       console.log("request ip is ", ip);
       
    } catch (error) {
        console.log(chalk.red("Verify token error: "), error);
        return processResponse({ req, res, success: false, status: 500, message: "Could not verify user", results: { force_logout: true }});
    }
}

module.exports = authenticate;