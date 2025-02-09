// npm i cross-env fastify @fastify/cors dotenv mqtt mongoose-paginate-v2 nodemon date-fns mongoose chalk@3 @fastify/multipart @fastify/static

const dotenv = require('dotenv')
dotenv.config();
const fastify = require('fastify')
const cors = require('@fastify/cors');
const chalk = require("chalk");
const { format } = require("date-fns");



//http server
const app = fastify();
//setup cors
app.register(cors, {});
// file upload
const path = require("path");
app.register(require('@fastify/multipart'), {
    limits: { fileSize: 1000000000 } // 1GB
})

//connect to database
const dbConnect = require("./config/db.config.js");
const { subscribe } = require('diagnostics_channel');
dbConnect();
//register models
require("./models/index")
//log routes and times
let all_routes = []
app.addHook('onRoute', route => {
    let reg_route;
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    if (methods.includes(route.method.toUpperCase())) {
        reg_route = {
            method: route.method,
            url: route.url
        }
    }
    if (reg_route) all_routes.push(reg_route)
})
app.addHook('onRequest', (req, res, done) => {
    const now = Date.now();
    req.timestamp = now;
    done();
})
app.addHook('onResponse', (req, res, done) => {
    if (process.env.LOG_ROUTES) {
        const timestamp = req.timestamp
        const now = Date.now()
        if (process.env.LOG_ROUTES && req.method != 'OPTIONS') {
            console.log(chalk.hex('#9155fd').bold(`[${format(now, 'dd-MM-yyyy HH:mm:ss a')}]:`),
                chalk.hex('#ff9800').bold(req.method, '', req.headers.host), " url: ", chalk.blue(req.url), `time:`, now - timestamp, "ms", res.statusCode);
        }
    }
    done()
});
// routes
require('./routes/index.js')({ app });
async function main() {
    const port = process.env.PORT || 3001
    app.listen({ port, host: "0.0.0.0" });
    console.log(chalk.yellow("server running on port", port));
    if (process.env.LOG_ROUTES) console.log(chalk.blue("Registered routes: "), all_routes);

}
// 
main();
// const cron = require('node-cron');
// const { exec } = require("child_process");
// cron.schedule('*/10 * * * *', () => {
//     exec("bash /usr/local/bin/clearsyslog.sh", (error, stdout, stderr) => {
//         if (error) {
//             console.error(`Error: ${error.message}`);
//             return;
//         }
//         if (stderr) {
//             console.error(`Stderr: ${stderr}`);
//             return;
//         }
//         console.log(`Output: ${stdout}`);
//     });
// });