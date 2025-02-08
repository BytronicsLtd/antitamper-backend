const deviceRoutes = require("./devices/Device.route");
const activityLogsRoutes = require("./activity/Activity.route");
const factoryRoutes = require("./factories/factory.route");
const userRoutes = require("./users/user.route");
const dataRoutes = require("./data/data.route");

module.exports = ({ app }) => {
    deviceRoutes({ app });
    dataRoutes({ app });
    activityLogsRoutes({ app });
    factoryRoutes({ app });
    userRoutes({ app });
};
  