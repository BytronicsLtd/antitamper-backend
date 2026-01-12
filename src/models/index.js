// Pre-load all models to ensure they're registered with Mongoose
// before any populate() calls reference them
require('./activityLog');
require('./alerts.model');
require('./data.model');
require('./device.model');
require('./error.model');
require('./factory');
require('./raw-data.model');
require('./scales-dump.model');
require('./user');
