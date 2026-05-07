/**
 * Scope levels — the four-tier hierarchy a user is bound to.
 *
 * SYSTEM   — no entity binding; sees everything.
 * NATIONAL — no entity binding; sees all regions.
 * REGIONAL — bound to one regionId; sees that region + its factories.
 * FACTORY  — bound to one factoryId; sees that factory only.
 *
 * Standardised UPPERCASE end-to-end. The legacy lowercase aliases below
 * exist only for the migration's read path; once the migration runs, all
 * persisted levels are uppercase.
 */

const LEVELS = Object.freeze({
  SYSTEM: 'SYSTEM',
  NATIONAL: 'NATIONAL',
  REGIONAL: 'REGIONAL',
  FACTORY: 'FACTORY',
});

const LEVEL_LIST = Object.freeze([
  LEVELS.SYSTEM,
  LEVELS.NATIONAL,
  LEVELS.REGIONAL,
  LEVELS.FACTORY,
]);

// SYSTEM = 0 (broadest). Higher number = narrower scope.
const LEVEL_RANK = Object.freeze({
  [LEVELS.SYSTEM]: 0,
  [LEVELS.NATIONAL]: 1,
  [LEVELS.REGIONAL]: 2,
  [LEVELS.FACTORY]: 3,
});

const LEGACY_LEVEL_MAP = Object.freeze({
  global: LEVELS.SYSTEM,
  // The legacy "admin" level (sometimes stored as "ADMIN" in older docs)
  // was the pre-rename name for the SYSTEM tier. In every observed record
  // it pairs with role: 'sys-admin'.
  admin: LEVELS.SYSTEM,
  national: LEVELS.NATIONAL,
  region: LEVELS.REGIONAL,
  factory: LEVELS.FACTORY,
});

function normaliseLevel(value) {
  if (!value) return null;
  if (LEVEL_LIST.includes(value)) return value;
  const lower = String(value).toLowerCase();
  return LEGACY_LEVEL_MAP[lower] || null;
}

function isLevelAtLeastAsBroadAs(a, b) {
  const ra = LEVEL_RANK[a];
  const rb = LEVEL_RANK[b];
  if (ra == null || rb == null) return false;
  return ra <= rb;
}

/**
 * Compare a user's level (in either legacy lowercase or canonical
 * uppercase) against a canonical LEVELS.* constant. Use this everywhere
 * a controller needs to branch on level — it's safe through the
 * migration window.
 */
function isLevel(user, target) {
  if (!user || !user.level) return false;
  return normaliseLevel(user.level) === target;
}

module.exports = {
  LEVELS,
  LEVEL_LIST,
  LEVEL_RANK,
  LEGACY_LEVEL_MAP,
  normaliseLevel,
  isLevelAtLeastAsBroadAs,
  isLevel,
};
