const { expandRoleList } = require('../permissions');

/**
 * Role guard. Accepts both legacy role names (Manager, ICT Manager, FUM,
 * FSC, root, user) and canonical names (regional-manager, factory-admin,
 * etc.) — legacy names are expanded to the set of canonical roles they
 * could map to, so the guard keeps working through the role-rename
 * migration window.
 *
 * Once task #3 replaces every checkRole(...) call site with a can()
 * lookup this middleware can be deleted entirely.
 */
const checkRole = (roles) => {
  const admit = expandRoleList(roles);
  return async function (req, res) {
    if (!admit.has(req.user?.role)) {
      res.status(403).send({
        success: false,
        message: "You do not have permission to access this resource",
      });
    }
  };
};

module.exports = checkRole;
