/**
 * Invitation matrix — who can invite whom into which scope.
 *
 * Two checks:
 *
 *   canInvite(inviter, target) → boolean
 *     Whether `inviter` (a User-shaped object with role/level/regionId/factoryId)
 *     is allowed to create an invitation with the given target shape
 *     `{ level, role, regionId?, factoryId? }`.
 *
 *   inviteScopeFor(inviter) → { allowedLevels, regionId?, factoryId? }
 *     What the UI should let the inviter pick. Used to populate dropdowns.
 *
 * Sys-admin invites anywhere. National-manager invites at NATIONAL,
 * REGIONAL, FACTORY but never SYSTEM. Regional-manager invites within
 * their regionId at REGIONAL or FACTORY. Factory-admin invites at FACTORY
 * within their factoryId. Viewers/supervisors invite no one.
 */

const { LEVELS } = require('./levels');
const { ROLES, levelForRole } = require('./roles');

const INVITER_RULES = Object.freeze({
  [ROLES.SYS_ADMIN]: {
    allowedLevels: [LEVELS.SYSTEM, LEVELS.NATIONAL, LEVELS.REGIONAL, LEVELS.FACTORY],
    constrainBy: null,
  },
  [ROLES.NATIONAL_MANAGER]: {
    allowedLevels: [LEVELS.NATIONAL, LEVELS.REGIONAL, LEVELS.FACTORY],
    constrainBy: null,
  },
  [ROLES.REGIONAL_MANAGER]: {
    allowedLevels: [LEVELS.REGIONAL, LEVELS.FACTORY],
    constrainBy: 'region',
  },
  [ROLES.FACTORY_ADMIN]: {
    allowedLevels: [LEVELS.FACTORY],
    constrainBy: 'factory',
  },
});

// User docs carry `region`/`factory` per the Mongoose schema, but tests
// and the in-memory shapes sometimes use `regionId`/`factoryId`. Read both.
function inviterRegion(inviter) {
  return inviter?.regionId ?? inviter?.region ?? null;
}
function inviterFactory(inviter) {
  return inviter?.factoryId ?? inviter?.factory ?? null;
}

function inviteScopeFor(inviter) {
  if (!inviter || !inviter.role) {
    return { allowedLevels: [], regionId: null, factoryId: null };
  }
  const rule = INVITER_RULES[inviter.role];
  if (!rule) {
    return { allowedLevels: [], regionId: null, factoryId: null };
  }
  return {
    allowedLevels: rule.allowedLevels.slice(),
    regionId:
      rule.constrainBy === 'region' || rule.constrainBy === 'factory'
        ? inviterRegion(inviter)
        : null,
    factoryId: rule.constrainBy === 'factory' ? inviterFactory(inviter) : null,
  };
}

function asString(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && typeof v.toString === 'function') return v.toString();
  return null;
}

/**
 * canInvite(inviter, target) → { ok: true } | { ok: false, reason }
 *
 * `inviter` is a User-shaped object: { role, level, regionId?, factoryId? }.
 * `target`  is the proposed invitation: { level, role, regionId?, factoryId? }.
 */
function canInvite(inviter, target) {
  if (!inviter || !inviter.role) return { ok: false, reason: 'inviter has no role' };
  if (!target || !target.level || !target.role) return { ok: false, reason: 'target requires level and role' };

  const rule = INVITER_RULES[inviter.role];
  if (!rule) return { ok: false, reason: 'role cannot invite users' };

  if (!rule.allowedLevels.includes(target.level)) {
    return { ok: false, reason: `role ${inviter.role} cannot invite at level ${target.level}` };
  }

  // Role must agree with target level.
  const expectedLevel = levelForRole(target.role);
  if (expectedLevel !== target.level) {
    return { ok: false, reason: `role ${target.role} does not belong to level ${target.level}` };
  }

  // Scope constraints
  if (rule.constrainBy === 'region') {
    const ir = asString(inviterRegion(inviter));
    if (!ir) return { ok: false, reason: 'inviter has no region' };
    if (target.level === LEVELS.REGIONAL) {
      if (asString(target.regionId) !== ir) {
        return { ok: false, reason: 'cannot invite to a different region' };
      }
    }
    if (target.level === LEVELS.FACTORY) {
      // factoryId must belong to the inviter's region — verified by caller
      // against the Factory document. Here we just require it's set.
      if (!asString(target.factoryId)) return { ok: false, reason: 'factory invite requires factoryId' };
    }
  }

  if (rule.constrainBy === 'factory') {
    const ifc = asString(inviterFactory(inviter));
    if (!ifc) return { ok: false, reason: 'inviter has no factory' };
    if (asString(target.factoryId) !== ifc) {
      return { ok: false, reason: 'cannot invite to a different factory' };
    }
  }

  // Required entity binding for the target level
  if (target.level === LEVELS.REGIONAL && !asString(target.regionId)) {
    return { ok: false, reason: 'REGIONAL target requires regionId' };
  }
  if (target.level === LEVELS.FACTORY && !asString(target.factoryId)) {
    return { ok: false, reason: 'FACTORY target requires factoryId' };
  }

  return { ok: true };
}

module.exports = {
  INVITER_RULES,
  canInvite,
  inviteScopeFor,
};
