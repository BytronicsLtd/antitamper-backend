const mongoose = require('mongoose');
const RegionModel = require('../../src/models/region.model');
const FactoryModel = require('../../src/models/factory');
const {
  buildRegionVisibilityQuery,
  getVisibleRegionIds,
  getVisibleFactoryIds,
  applyRegionFilter,
  applyFactoryFilter,
  showTestData,
} = require('../../src/utils/testRegionFilter.util');

describe('testRegionFilter (canonical regions)', () => {
  let realRegion, testRegion, factoryReal, factoryTest;

  beforeEach(async () => {
    realRegion = await RegionModel.create({ name: 'Region A', code: '1', isTest: false });
    testRegion = await RegionModel.create({ name: 'Region T', code: '99', isTest: true });
    factoryReal = await FactoryModel.create({
      name: 'Real Factory', location: 'Town', region: realRegion._id, status: 'active',
    });
    factoryTest = await FactoryModel.create({
      name: 'Test Factory', location: 'Town', region: testRegion._id, status: 'active',
    });
  });

  describe('showTestData()', () => {
    it('reads new key', () => {
      expect(showTestData({ settings: { showTestData: true } })).toBe(true);
      expect(showTestData({ settings: { showTestData: false } })).toBe(false);
    });
    it('falls back to legacy key', () => {
      expect(showTestData({ settings: { showTestRegions: true } })).toBe(true);
    });
    it('defaults to false when settings missing', () => {
      expect(showTestData({})).toBe(false);
    });
  });

  describe('buildRegionVisibilityQuery', () => {
    it('sys-admin without showTestData: only non-test', () => {
      const q = buildRegionVisibilityQuery({ role: 'sys-admin', settings: {} });
      expect(q.isTest).toBe(false);
    });
    it('sys-admin with showTestData: no isTest filter', () => {
      const q = buildRegionVisibilityQuery({ role: 'sys-admin', settings: { showTestData: true } });
      expect(q.isTest).toBeUndefined();
    });
    it('region-level user: own region OR non-test', () => {
      const q = buildRegionVisibilityQuery({ role: 'Manager', region: realRegion._id });
      expect(q.$or).toBeTruthy();
    });
    it('plain user: only non-test', () => {
      const q = buildRegionVisibilityQuery({ role: 'user' });
      expect(q.isTest).toBe(false);
    });
  });

  describe('getVisibleRegionIds', () => {
    it('sys-admin sees both when toggle on', async () => {
      const ids = await getVisibleRegionIds({ role: 'sys-admin', settings: { showTestData: true } });
      expect(ids).toHaveLength(2);
    });
    it('sys-admin sees only real when toggle off', async () => {
      const ids = await getVisibleRegionIds({ role: 'sys-admin', settings: {} });
      expect(ids).toHaveLength(1);
      expect(ids[0].toString()).toBe(realRegion._id.toString());
    });
    it('user in test region sees both', async () => {
      const ids = await getVisibleRegionIds({ role: 'Manager', region: testRegion._id });
      const stringIds = ids.map((i) => i.toString());
      expect(stringIds).toContain(realRegion._id.toString());
      expect(stringIds).toContain(testRegion._id.toString());
    });
  });

  describe('getVisibleFactoryIds', () => {
    it('factory-level returns own factory only', async () => {
      const ids = await getVisibleFactoryIds({ level: 'factory', factory: factoryTest._id });
      expect(ids).toHaveLength(1);
      expect(ids[0].toString()).toBe(factoryTest._id.toString());
    });
    it('sys-admin without toggle excludes test-region factories', async () => {
      const ids = await getVisibleFactoryIds({ role: 'sys-admin', settings: {} });
      expect(ids.map((i) => i.toString())).toEqual([factoryReal._id.toString()]);
    });
    it('sys-admin with toggle includes test-region factories', async () => {
      const ids = await getVisibleFactoryIds({ role: 'sys-admin', settings: { showTestData: true } });
      expect(ids).toHaveLength(2);
    });
  });

  describe('applyRegionFilter / applyFactoryFilter', () => {
    it('apply region $in', () => {
      const q = applyRegionFilter({}, [realRegion._id]);
      expect(q.region.$in).toEqual([realRegion._id]);
    });
    it('apply factory $in', () => {
      const q = applyFactoryFilter({}, [factoryReal._id, factoryTest._id]);
      expect(q.factory.$in).toHaveLength(2);
    });
  });
});
