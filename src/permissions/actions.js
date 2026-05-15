/**
 * Action matrix — role × action → boolean.
 *
 * Action format is "<resource>:<verb>". Scope ("can sys-admin write
 * factories anywhere?  yes — can a regional-manager write factories?  yes,
 * but only in their region") is enforced separately by `inScope()` against
 * the resource. This file only answers: does the role unlock the verb at
 * all?
 *
 * Add new actions here as features land — every gate in the codebase
 * should resolve through `can()` so this file stays the single source of
 * truth for what each role unlocks.
 */

const { ROLES } = require('./roles');

const R = ROLES;

// Read = R, Write = W (which implies R), None = -.
const RW = ['read', 'write'];
const RO = ['read'];

const RESOURCE_VERBS = {
  factories: {
    [R.SYS_ADMIN]: RW,
    [R.NATIONAL_MANAGER]: RW,
    [R.NATIONAL_VIEWER]: RO,
    [R.REGIONAL_MANAGER]: RW,
    [R.REGIONAL_VIEWER]: RO,
    [R.FACTORY_ADMIN]: RO,
    [R.FACTORY_SUPERVISOR]: RO,
    [R.FACTORY_VIEWER]: RO,
  },
  devices: {
    [R.SYS_ADMIN]: RW,
    [R.NATIONAL_MANAGER]: RW,
    [R.NATIONAL_VIEWER]: RO,
    [R.REGIONAL_MANAGER]: RW,
    [R.REGIONAL_VIEWER]: RO,
    [R.FACTORY_ADMIN]: RW,
    [R.FACTORY_SUPERVISOR]: RO,
    [R.FACTORY_VIEWER]: RO,
  },
  data: {
    [R.SYS_ADMIN]: RW,
    [R.NATIONAL_MANAGER]: RO,
    [R.NATIONAL_VIEWER]: RO,
    [R.REGIONAL_MANAGER]: RO,
    [R.REGIONAL_VIEWER]: RO,
    [R.FACTORY_ADMIN]: RO,
    [R.FACTORY_SUPERVISOR]: RO,
    [R.FACTORY_VIEWER]: RO,
  },
  alerts: {
    [R.SYS_ADMIN]: RW,
    [R.NATIONAL_MANAGER]: RW,
    [R.NATIONAL_VIEWER]: RO,
    [R.REGIONAL_MANAGER]: RW,
    [R.REGIONAL_VIEWER]: RO,
    [R.FACTORY_ADMIN]: RW,
    [R.FACTORY_SUPERVISOR]: RO,
    [R.FACTORY_VIEWER]: RO,
  },
  users: {
    [R.SYS_ADMIN]: RW,
    [R.NATIONAL_MANAGER]: RW,
    [R.NATIONAL_VIEWER]: [],
    [R.REGIONAL_MANAGER]: RW,
    [R.REGIONAL_VIEWER]: [],
    [R.FACTORY_ADMIN]: RW,
    [R.FACTORY_SUPERVISOR]: [],
    [R.FACTORY_VIEWER]: [],
  },
  pdas: {
    [R.SYS_ADMIN]: RW,
    [R.NATIONAL_MANAGER]: RW,
    [R.NATIONAL_VIEWER]: RO,
    [R.REGIONAL_MANAGER]: RW,
    [R.REGIONAL_VIEWER]: RO,
    [R.FACTORY_ADMIN]: RW,
    [R.FACTORY_SUPERVISOR]: RO,
    [R.FACTORY_VIEWER]: RO,
  },
  regions: {
    [R.SYS_ADMIN]: RW,
    [R.NATIONAL_MANAGER]: RW,
    [R.NATIONAL_VIEWER]: RO,
    [R.REGIONAL_MANAGER]: RO,
    [R.REGIONAL_VIEWER]: RO,
    [R.FACTORY_ADMIN]: [],
    [R.FACTORY_SUPERVISOR]: [],
    [R.FACTORY_VIEWER]: [],
  },
  // Everyone can read activity logs at minimum (their own); the page tabs
  // and the backend controller scope what each role actually sees.
  activityLogs: {
    [R.SYS_ADMIN]: RO,
    [R.NATIONAL_MANAGER]: RO,
    [R.NATIONAL_VIEWER]: RO,
    [R.REGIONAL_MANAGER]: RO,
    [R.REGIONAL_VIEWER]: RO,
    [R.FACTORY_ADMIN]: RO,
    [R.FACTORY_SUPERVISOR]: RO,
    [R.FACTORY_VIEWER]: RO,
  },
};

// Singleton actions (no resource scoping).
const SINGLETON_ACTIONS = {
  'settings.testData:write': new Set([R.SYS_ADMIN]),
  'settings.impersonation:use': new Set([R.SYS_ADMIN]),
};

/**
 * can(role, action) — does this role unlock this action at all?
 *
 * Action forms accepted:
 *   - "factories:read"          → resource:verb lookup
 *   - "settings.testData:write" → singleton lookup
 *
 * Scope (own region / own factory) is enforced by inScope(), not here.
 */
function can(role, action) {
  if (!role || !action) return false;

  if (SINGLETON_ACTIONS[action]) {
    return SINGLETON_ACTIONS[action].has(role);
  }

  const [resource, verb] = action.split(':');
  if (!resource || !verb) return false;

  const matrix = RESOURCE_VERBS[resource];
  if (!matrix) return false;

  const verbs = matrix[role];
  if (!verbs) return false;

  // 'write' implies 'read'
  if (verb === 'read' && verbs.includes('write')) return true;
  return verbs.includes(verb);
}

module.exports = {
  RESOURCE_VERBS,
  SINGLETON_ACTIONS,
  can,
};
