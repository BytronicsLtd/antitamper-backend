/**
 * Roles — action sets within a level. A user is a (level, role, scopeId?)
 * tuple. Same name like "manager" means different things at different
 * levels, so roles are namespaced by level prefix to keep that explicit.
 */

const { LEVELS } = require('./levels');

const ROLES = Object.freeze({
  SYS_ADMIN: 'sys-admin',
  NATIONAL_MANAGER: 'national-manager',
  NATIONAL_VIEWER: 'national-viewer',
  REGIONAL_MANAGER: 'regional-manager',
  REGIONAL_VIEWER: 'regional-viewer',
  FACTORY_ADMIN: 'factory-admin',
  FACTORY_SUPERVISOR: 'factory-supervisor',
  FACTORY_VIEWER: 'factory-viewer',
});

const ROLE_LIST = Object.freeze(Object.values(ROLES));

// Which level each role belongs to. Used by validators to enforce that a
// user's role and level agree.
const ROLE_LEVEL = Object.freeze({
  [ROLES.SYS_ADMIN]: LEVELS.SYSTEM,
  [ROLES.NATIONAL_MANAGER]: LEVELS.NATIONAL,
  [ROLES.NATIONAL_VIEWER]: LEVELS.NATIONAL,
  [ROLES.REGIONAL_MANAGER]: LEVELS.REGIONAL,
  [ROLES.REGIONAL_VIEWER]: LEVELS.REGIONAL,
  [ROLES.FACTORY_ADMIN]: LEVELS.FACTORY,
  [ROLES.FACTORY_SUPERVISOR]: LEVELS.FACTORY,
  [ROLES.FACTORY_VIEWER]: LEVELS.FACTORY,
});

/**
 * Legacy role map. The migration uses this to remap existing User docs.
 * Some legacy roles are ambiguous without knowing the user's previous
 * level (e.g. `Manager` could be national or regional in the old data),
 * so the migration logic resolves that by reading the old level too.
 */
const LEGACY_ROLE_MAP = Object.freeze({
  root: ROLES.SYS_ADMIN,
  'sys-admin': ROLES.SYS_ADMIN,
  admin: { byLevel: { SYSTEM: ROLES.SYS_ADMIN, NATIONAL: ROLES.NATIONAL_MANAGER, REGIONAL: ROLES.REGIONAL_MANAGER, FACTORY: ROLES.FACTORY_ADMIN } },
  Manager: { byLevel: { SYSTEM: ROLES.SYS_ADMIN, NATIONAL: ROLES.NATIONAL_MANAGER, REGIONAL: ROLES.REGIONAL_MANAGER, FACTORY: ROLES.FACTORY_ADMIN } },
  'ICT Manager': { byLevel: { SYSTEM: ROLES.SYS_ADMIN, NATIONAL: ROLES.NATIONAL_MANAGER, REGIONAL: ROLES.REGIONAL_MANAGER, FACTORY: ROLES.FACTORY_ADMIN } },
  FUM: ROLES.FACTORY_ADMIN,
  FSC: ROLES.FACTORY_SUPERVISOR,
  user: { byLevel: { SYSTEM: ROLES.SYS_ADMIN, NATIONAL: ROLES.NATIONAL_VIEWER, REGIONAL: ROLES.REGIONAL_VIEWER, FACTORY: ROLES.FACTORY_VIEWER } },
});

function resolveLegacyRole(legacyRole, level) {
  const entry = LEGACY_ROLE_MAP[legacyRole];
  if (!entry) return null;
  if (typeof entry === 'string') return entry;
  if (entry.byLevel && level && entry.byLevel[level]) return entry.byLevel[level];
  return null;
}

function levelForRole(role) {
  return ROLE_LEVEL[role] || null;
}

/**
 * Expand a legacy role name to all canonical roles it could remap to.
 * Used by the temporary checkRole shim while we still have route guards
 * referring to legacy strings — once task #3 replaces them with can()
 * lookups this helper can be deleted.
 */
function expandLegacyRole(legacyRole) {
  const entry = LEGACY_ROLE_MAP[legacyRole];
  if (!entry) return null;
  if (typeof entry === 'string') return [entry];
  if (entry.byLevel) return [...new Set(Object.values(entry.byLevel))];
  return null;
}

/**
 * Build the admit set for a legacy-style role list (mix of canonical and
 * legacy strings). Returns a Set of canonical role names.
 */
function expandRoleList(roleList) {
  const out = new Set();
  for (const r of roleList || []) {
    if (ROLE_LIST.includes(r)) {
      out.add(r);
      continue;
    }
    const expanded = expandLegacyRole(r);
    if (expanded) expanded.forEach((x) => out.add(x));
  }
  return out;
}

module.exports = {
  ROLES,
  ROLE_LIST,
  ROLE_LEVEL,
  LEGACY_ROLE_MAP,
  resolveLegacyRole,
  levelForRole,
  expandLegacyRole,
  expandRoleList,
};
