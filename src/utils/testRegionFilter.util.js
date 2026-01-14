/**
 * Test Region Filter Utility
 *
 * Provides functions to filter regions based on user permissions and settings.
 *
 * Visibility Rules:
 * - Sys-admin with showTestRegions=true: See all regions
 * - User in test region: See their own region + non-test regions
 * - Everyone else: Only non-test regions
 */

const RegionModel = require('../models/region.model');

/**
 * Get list of region names visible to the user
 * @param {Object} user - The authenticated user object
 * @returns {Promise<string[]>} Array of visible region names
 */
async function getVisibleRegions(user) {
  const isSysAdmin = ['root', 'sys-admin'].includes(user.role);
  const showTestRegions = user.settings?.showTestRegions || false;

  let query = { soft_deleted: { $ne: true } };

  // Sys-admin with toggle enabled sees all regions
  if (isSysAdmin && showTestRegions) {
    const regions = await RegionModel.find(query).select('name');
    return regions.map(r => r.name);
  }

  // User in a specific region can see their region + non-test regions
  if (user.region) {
    query.$or = [
      { isTest: false },
      { name: user.region }
    ];
  } else {
    // Everyone else sees only non-test regions
    query.isTest = false;
  }

  const regions = await RegionModel.find(query).select('name');
  return regions.map(r => r.name);
}

/**
 * Apply region filter to a query object
 * @param {Object} query - The MongoDB query object
 * @param {string[]} visibleRegions - Array of visible region names
 * @param {string} regionField - The field name for region in the query (default: 'region')
 * @returns {Object} Modified query object
 */
function applyRegionFilter(query, visibleRegions, regionField = 'region') {
  if (visibleRegions && visibleRegions.length > 0) {
    query[regionField] = { $in: visibleRegions };
  }
  return query;
}

/**
 * Check if user can access a specific region
 * @param {Object} user - The authenticated user object
 * @param {string} regionName - The region name to check
 * @returns {Promise<boolean>} Whether the user can access the region
 */
async function canAccessRegion(user, regionName) {
  const visibleRegions = await getVisibleRegions(user);
  return visibleRegions.includes(regionName);
}

/**
 * Build region visibility query for use in aggregations or direct queries
 * @param {Object} user - The authenticated user object
 * @returns {Object} MongoDB query for region visibility
 */
function buildRegionVisibilityQuery(user) {
  const isSysAdmin = ['root', 'sys-admin'].includes(user.role);
  const showTestRegions = user.settings?.showTestRegions || false;

  // Sys-admin with toggle sees all
  if (isSysAdmin && showTestRegions) {
    return { soft_deleted: { $ne: true } };
  }

  // User in a region sees their region + non-test
  if (user.region) {
    return {
      soft_deleted: { $ne: true },
      $or: [
        { isTest: false },
        { name: user.region }
      ]
    };
  }

  // Everyone else sees only non-test
  return {
    soft_deleted: { $ne: true },
    isTest: false
  };
}

module.exports = {
  getVisibleRegions,
  applyRegionFilter,
  canAccessRegion,
  buildRegionVisibilityQuery
};
