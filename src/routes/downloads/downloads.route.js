const controller = require('../../controllers/downloads/downloads.controller');

// Public catalogue + file fetch. APKs need to be reachable on a phone
// before any login flow, so we deliberately leave these unauthenticated.
module.exports = ({ app }) => {
  app.get('/api/v1/downloads/', (req, res) => controller.list(req, res));
  app.get('/api/v1/downloads/:filename', (req, res) => controller.serve(req, res));
};
