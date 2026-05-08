/**
 * Region/factory visibility utility (canonical-Region edition).
 *
 * Source of truth: Region docs with `isTest` boolean.
 *
 * Visibility rules:
 *   - sys-admin/root with settings.showTestData=true → see all regions and factories.
 *   - region-level user → sees own region + all non-test regions.
 *   - factory-level user → sees own factory only.
 *   - everyone else → only non-test regions.
 *
 * For collections that filter by `factory` (devices, data, alerts, pdas), use
 * getVisibleFactoryIds() — it resolves visible regions → factories of those
 * regions → an `{ $in: [...] }` filter on `factory`.
 */

const mongoose = require('mongoose');
const RegionModel = require('../models/region.model');
const FactoryModel = require('../models/factory');
const { isLevel, LEVELS } = require('../permissions');

const ELEVATED_ROLES = ['root', 'sys-admin'];

function isSysAdmin(user) {
  return ELEVATED_ROLES.includes(user.role);
}

function showTestData(user) {
  // Backward-read: prefer new key, fall back to legacy.
  return !!(user.settings?.showTestData ?? user.settings?.showTestRegions);
}

/**
 * Mongo query that selects the regions visible to a user.
 * Honours soft_deleted, isTest, and the user's own region.
 */
function buildRegionVisibilityQuery(user) {
  const base = { soft_deleted: { $ne: true } };

  // Sys-admin / root with the showTestData toggle on → see every region,
  // including test ones.
  if (isSysAdmin(user) && showTestData(user)) return base;

  // Regional users are strictly bound to their own region. The previous
  // implementation OR'd { isTest: false } here, which leaked every
  // non-test region to a regional manager — making them effectively
  // national-scope.
  if (isLevel(user, LEVELS.REGIONAL) && user.region) {
    return { ...base, _id: user.region };
  }

  // Factory users — only their factory's region. getVisibleFactoryIds
  // shortcuts factory-level users without going through this query, so
  // this branch only matters for region-list reads. Resolve to "no
  // regions visible" if the binding is unset; the FactoryModel.findById
  // fallback in getVisibleFactoryIds covers the user.factory case.
  if (isLevel(user, LEVELS.FACTORY)) {
    return { ...base, _id: { $in: [] } };
  }

  // National (and sys-admin without showTestData) → all non-test regions.
  return { ...base, isTest: false };
}

/**
 * Resolve visible regions to ObjectId[].
 */
async function getVisibleRegionIds(user) {
  const docs = await RegionModel.find(buildRegionVisibilityQuery(user)).select('_id').lean();
  return docs.map((d) => d._id);
}

/**
 * Resolve visible factories to ObjectId[]. Factories of visible regions, minus
 * soft-deleted ones. For factory-level users, the filter is just their factory.
 */
async function getVisibleFactoryIds(user) {
  if (isLevel(user, LEVELS.FACTORY) && user.factory) {
    return [toId(user.factory)];
  }
  const regionIds = await getVisibleRegionIds(user);
  const docs = await FactoryModel.find({
    soft_deleted: { $ne: true },
    region: { $in: regionIds },
  }).select('_id').lean();
  return docs.map((d) => d._id);
}

/**
 * Apply a region filter to a query (for collections that store region directly,
 * i.e. Region collection itself and Factory).
 */
function applyRegionFilter(query, regionIds) {
  if (Array.isArray(regionIds)) {
    query.region = { $in: regionIds };
  }
  return query;
}

/**
 * Apply a factory filter to a query (for Device/Data/Alert/PDA which store factory id).
 */
function applyFactoryFilter(query, factoryIds) {
  if (Array.isArray(factoryIds)) {
    query.factory = { $in: factoryIds };
  }
  return query;
}

async function canAccessRegion(user, regionId) {
  const ids = await getVisibleRegionIds(user);
  return ids.some((i) => i.toString() === regionId.toString());
}

function toId(v) {
  if (!v) return v;
  if (v._bsontype === 'ObjectId') return v;
  if (typeof v === 'string' && mongoose.Types.ObjectId.isValid(v)) return new mongoose.Types.ObjectId(v);
  return v;
}

/**
 * Authorization gate for write operations against a specific factory.
 * Resolves to true if the user is allowed to create/update/delete records
 * scoped to factoryId (e.g. a Device under that factory).
 */
async function canActOnFactory(user, factoryId) {
  if (!factoryId) return false;
  if (isSysAdmin(user)) return true;
  if (isLevel(user, LEVELS.FACTORY)) {
    return asString(user.factory) === asString(factoryId);
  }
  if (isLevel(user, LEVELS.REGIONAL)) {
    if (!user.region) return false;
    const factory = await FactoryModel.findById(factoryId).select('region').lean();
    if (!factory) return false;
    return asString(factory.region) === asString(user.region);
  }
  // National-level: must be a factory in a visible (non-test) region.
  const factory = await FactoryModel.findById(factoryId).select('region').lean();
  if (!factory) return false;
  const regionIds = await getVisibleRegionIds(user);
  return regionIds.some((id) => asString(id) === asString(factory.region));
}

function asString(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (v._bsontype === 'ObjectId') return v.toString();
  return String(v);
}

module.exports = {
  buildRegionVisibilityQuery,
  getVisibleRegionIds,
  getVisibleFactoryIds,
  applyRegionFilter,
  applyFactoryFilter,
  canAccessRegion,
  canActOnFactory,
  isSysAdmin,
  showTestData,
};
