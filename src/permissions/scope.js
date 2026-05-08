/**
 * Scope enforcement — second layer after `can()`. Answers: does this user's
 * scope reach this resource?
 *
 *   inScope(user, resource, opts) → boolean
 *
 * The matrix in actions.js says whether the role can perform the verb at
 * all. This module says whether the resource is within the user's
 * regionId/factoryId.
 *
 * Resource shapes accepted:
 *   { region: ObjectId|String|{_id|id} }
 *   { factory: ObjectId|String|{_id|id, region?} }
 *   { regionId, factoryId }   (already flattened)
 */

const { LEVELS } = require('./levels');

function asString(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    if (typeof v.toString === 'function') return v.toString();
    if (v._id) return asString(v._id);
    if (v.id) return asString(v.id);
  }
  return null;
}

function regionOf(resource) {
  if (!resource) return null;
  if (resource.regionId) return asString(resource.regionId);
  if (resource.region) {
    if (typeof resource.region === 'string') return resource.region;
    return asString(resource.region._id || resource.region.id || resource.region);
  }
  if (resource.factory && typeof resource.factory === 'object') {
    return regionOf(resource.factory);
  }
  return null;
}

function factoryOf(resource) {
  if (!resource) return null;
  if (resource.factoryId) return asString(resource.factoryId);
  if (resource.factory) {
    if (typeof resource.factory === 'string') return resource.factory;
    return asString(resource.factory._id || resource.factory.id || resource.factory);
  }
  return null;
}

function inScope(user, resource) {
  if (!user || !user.level) return false;

  switch (user.level) {
    case LEVELS.SYSTEM:
    case LEVELS.NATIONAL:
      return true;

    case LEVELS.REGIONAL: {
      const userRegion = asString(user.regionId);
      if (!userRegion) return false;
      const resourceRegion = regionOf(resource);
      return !!resourceRegion && resourceRegion === userRegion;
    }

    case LEVELS.FACTORY: {
      const userFactory = asString(user.factoryId);
      if (!userFactory) return false;
      const resourceFactory = factoryOf(resource);
      return !!resourceFactory && resourceFactory === userFactory;
    }

    default:
      return false;
  }
}

/**
 * Filter clause builder: returns a Mongo query fragment that restricts
 * documents to the user's scope. Use as a base when listing resources.
 */
function scopeFilter(user, { regionField = 'region', factoryField = 'factory' } = {}) {
  if (!user || !user.level) return { _scopeReject: true };
  switch (user.level) {
    case LEVELS.SYSTEM:
    case LEVELS.NATIONAL:
      return {};
    case LEVELS.REGIONAL:
      return user.regionId ? { [regionField]: user.regionId } : { _scopeReject: true };
    case LEVELS.FACTORY:
      return user.factoryId ? { [factoryField]: user.factoryId } : { _scopeReject: true };
    default:
      return { _scopeReject: true };
  }
}

module.exports = {
  inScope,
  scopeFilter,
  regionOf,
  factoryOf,
};
