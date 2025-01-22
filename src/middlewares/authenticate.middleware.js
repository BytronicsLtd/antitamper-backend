const processResponse = require("../utils/processResponse");

const authenticate = async (req, res) => {
    try {
       const ip =  req.ip;
       console.log("request ip is ", ip);
       const contentLength = req.headers['content-length'];

       if (contentLength) {
           const payloadSize = parseInt(contentLength, 10);
           console.log(`Request payload size: ${payloadSize} bytes`);
       } else {
           console.log('No Content-Length header found');
           return { error: 'No Content-Length header found' };
       }
       
    } catch (error) {
        console.log(chalk.red("Verify token error: "), error);
        return processResponse({ req, res, success: false, status: 500, message: "Could not verify user", results: { force_logout: true }});
    }
}

module.exports = authenticate;