const scalesRoutes = require("./scales/Device.route");
const activityLogsRoutes = require("./scales/Activity.route");
const FactoryRoutes = require("./scales/Factory.route");
const UserRoutes = require("./scales/User.route");

module.exports = ({ app }) => {
    scalesRoutes({ app });
    activityLogsRoutes({ app });
    FactoryRoutes({ app });
    UserRoutes({ app });
};
  