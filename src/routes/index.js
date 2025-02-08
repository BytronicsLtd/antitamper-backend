const deviceRoutes = require("./devices/device.route");
const activityLogsRoutes = require("./activity/activity.route");
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
  