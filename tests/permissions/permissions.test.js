/**
 * Pure-data registry tests. No DB.
 */

const {
  LEVELS,
  ROLES,
  can,
  inScope,
  canInvite,
  inviteScopeFor,
  resolveLegacyRole,
  normaliseLevel,
  levelForRole,
} = require('../../src/permissions');

describe('permissions/levels', () => {
  test('normaliseLevel maps legacy lowercase to UPPERCASE', () => {
    expect(normaliseLevel('global')).toBe(LEVELS.SYSTEM);
    expect(normaliseLevel('national')).toBe(LEVELS.NATIONAL);
    expect(normaliseLevel('region')).toBe(LEVELS.REGIONAL);
    expect(normaliseLevel('factory')).toBe(LEVELS.FACTORY);
  });
  test('normaliseLevel passes through canonical', () => {
    expect(normaliseLevel('SYSTEM')).toBe('SYSTEM');
  });
  test('normaliseLevel returns null for unknown', () => {
    expect(normaliseLevel('zone')).toBeNull();
    expect(normaliseLevel('')).toBeNull();
    expect(normaliseLevel(null)).toBeNull();
  });
});

describe('permissions/roles', () => {
  test('every role belongs to exactly one level', () => {
    Object.values(ROLES).forEach((r) => {
      expect(levelForRole(r)).toBeTruthy();
    });
  });
  test('legacy role remap respects level', () => {
    expect(resolveLegacyRole('FUM')).toBe(ROLES.FACTORY_ADMIN);
    expect(resolveLegacyRole('FSC')).toBe(ROLES.FACTORY_SUPERVISOR);
    expect(resolveLegacyRole('Manager', 'NATIONAL')).toBe(ROLES.NATIONAL_MANAGER);
    expect(resolveLegacyRole('Manager', 'REGIONAL')).toBe(ROLES.REGIONAL_MANAGER);
    expect(resolveLegacyRole('Manager', 'FACTORY')).toBe(ROLES.FACTORY_ADMIN);
    expect(resolveLegacyRole('user', 'FACTORY')).toBe(ROLES.FACTORY_VIEWER);
    expect(resolveLegacyRole('user', 'REGIONAL')).toBe(ROLES.REGIONAL_VIEWER);
    expect(resolveLegacyRole('root')).toBe(ROLES.SYS_ADMIN);
  });
  test('unknown legacy role yields null', () => {
    expect(resolveLegacyRole('nope', 'SYSTEM')).toBeNull();
  });
});

describe('permissions/actions can()', () => {
  test('sys-admin can everything declared', () => {
    expect(can(ROLES.SYS_ADMIN, 'factories:write')).toBe(true);
    expect(can(ROLES.SYS_ADMIN, 'devices:write')).toBe(true);
    expect(can(ROLES.SYS_ADMIN, 'settings.testData:write')).toBe(true);
    expect(can(ROLES.SYS_ADMIN, 'settings.impersonation:use')).toBe(true);
  });
  test('write implies read', () => {
    expect(can(ROLES.REGIONAL_MANAGER, 'devices:read')).toBe(true);
  });
  test('viewers cannot write', () => {
    expect(can(ROLES.FACTORY_VIEWER, 'devices:write')).toBe(false);
    expect(can(ROLES.NATIONAL_VIEWER, 'factories:write')).toBe(false);
  });
  test('factory-admin cannot edit factories', () => {
    // factory-admin manages devices/users in their factory but doesn't
    // mutate the factory entity itself.
    expect(can(ROLES.FACTORY_ADMIN, 'factories:read')).toBe(true);
    expect(can(ROLES.FACTORY_ADMIN, 'factories:write')).toBe(false);
  });
  test('only sys-admin gets singleton actions', () => {
    expect(can(ROLES.NATIONAL_MANAGER, 'settings.impersonation:use')).toBe(false);
    expect(can(ROLES.REGIONAL_MANAGER, 'settings.testData:write')).toBe(false);
  });
  test('viewers cannot manage users', () => {
    expect(can(ROLES.FACTORY_VIEWER, 'users:read')).toBe(false);
    expect(can(ROLES.REGIONAL_VIEWER, 'users:write')).toBe(false);
  });
  test('unknown role/action yields false', () => {
    expect(can('martian', 'devices:read')).toBe(false);
    expect(can(ROLES.SYS_ADMIN, 'unknown:read')).toBe(false);
    expect(can(ROLES.SYS_ADMIN, 'malformed')).toBe(false);
  });
});

describe('permissions/scope inScope()', () => {
  const sys = { level: LEVELS.SYSTEM };
  const nat = { level: LEVELS.NATIONAL };
  const reg = { level: LEVELS.REGIONAL, regionId: 'r1' };
  const fac = { level: LEVELS.FACTORY, factoryId: 'f1' };

  test('SYSTEM/NATIONAL see everything', () => {
    expect(inScope(sys, { region: 'r2' })).toBe(true);
    expect(inScope(nat, { region: 'r2' })).toBe(true);
  });
  test('REGIONAL only matches own region', () => {
    expect(inScope(reg, { region: 'r1' })).toBe(true);
    expect(inScope(reg, { region: 'r2' })).toBe(false);
    expect(inScope(reg, { region: { _id: 'r1' } })).toBe(true);
  });
  test('REGIONAL with no regionId fails closed', () => {
    expect(inScope({ level: LEVELS.REGIONAL }, { region: 'r1' })).toBe(false);
  });
  test('FACTORY matches by factoryId', () => {
    expect(inScope(fac, { factory: 'f1' })).toBe(true);
    expect(inScope(fac, { factory: 'f2' })).toBe(false);
    expect(inScope(fac, { factory: { _id: 'f1' } })).toBe(true);
  });
});

describe('permissions/invitations canInvite()', () => {
  const sys = { role: ROLES.SYS_ADMIN, level: LEVELS.SYSTEM };
  const nat = { role: ROLES.NATIONAL_MANAGER, level: LEVELS.NATIONAL };
  const reg = { role: ROLES.REGIONAL_MANAGER, level: LEVELS.REGIONAL, regionId: 'r1' };
  const fac = { role: ROLES.FACTORY_ADMIN, level: LEVELS.FACTORY, factoryId: 'f1', regionId: 'r1' };
  const viewer = { role: ROLES.FACTORY_VIEWER, level: LEVELS.FACTORY, factoryId: 'f1' };

  test('sys-admin invites anywhere', () => {
    expect(canInvite(sys, { level: LEVELS.SYSTEM, role: ROLES.SYS_ADMIN }).ok).toBe(true);
    expect(canInvite(sys, { level: LEVELS.NATIONAL, role: ROLES.NATIONAL_MANAGER }).ok).toBe(true);
    expect(canInvite(sys, { level: LEVELS.REGIONAL, role: ROLES.REGIONAL_MANAGER, regionId: 'r9' }).ok).toBe(true);
    expect(canInvite(sys, { level: LEVELS.FACTORY, role: ROLES.FACTORY_ADMIN, factoryId: 'f9' }).ok).toBe(true);
  });
  test('national-manager cannot invite at SYSTEM', () => {
    const r = canInvite(nat, { level: LEVELS.SYSTEM, role: ROLES.SYS_ADMIN });
    expect(r.ok).toBe(false);
  });
  test('national-manager invites at NATIONAL/REGIONAL/FACTORY', () => {
    expect(canInvite(nat, { level: LEVELS.NATIONAL, role: ROLES.NATIONAL_VIEWER }).ok).toBe(true);
    expect(canInvite(nat, { level: LEVELS.REGIONAL, role: ROLES.REGIONAL_MANAGER, regionId: 'rX' }).ok).toBe(true);
    expect(canInvite(nat, { level: LEVELS.FACTORY, role: ROLES.FACTORY_ADMIN, factoryId: 'fX' }).ok).toBe(true);
  });
  test('regional-manager confined to own region', () => {
    expect(canInvite(reg, { level: LEVELS.REGIONAL, role: ROLES.REGIONAL_VIEWER, regionId: 'r1' }).ok).toBe(true);
    expect(canInvite(reg, { level: LEVELS.REGIONAL, role: ROLES.REGIONAL_VIEWER, regionId: 'r2' }).ok).toBe(false);
    expect(canInvite(reg, { level: LEVELS.NATIONAL, role: ROLES.NATIONAL_MANAGER }).ok).toBe(false);
    expect(canInvite(reg, { level: LEVELS.SYSTEM, role: ROLES.SYS_ADMIN }).ok).toBe(false);
  });
  test('factory-admin confined to own factory', () => {
    expect(canInvite(fac, { level: LEVELS.FACTORY, role: ROLES.FACTORY_SUPERVISOR, factoryId: 'f1' }).ok).toBe(true);
    expect(canInvite(fac, { level: LEVELS.FACTORY, role: ROLES.FACTORY_VIEWER, factoryId: 'f2' }).ok).toBe(false);
    expect(canInvite(fac, { level: LEVELS.REGIONAL, role: ROLES.REGIONAL_VIEWER, regionId: 'r1' }).ok).toBe(false);
  });
  test('viewers cannot invite anyone', () => {
    expect(canInvite(viewer, { level: LEVELS.FACTORY, role: ROLES.FACTORY_VIEWER, factoryId: 'f1' }).ok).toBe(false);
  });
  test('role/level mismatch rejected', () => {
    expect(canInvite(sys, { level: LEVELS.FACTORY, role: ROLES.REGIONAL_MANAGER, factoryId: 'f1' }).ok).toBe(false);
  });
  test('REGIONAL target without regionId rejected', () => {
    expect(canInvite(sys, { level: LEVELS.REGIONAL, role: ROLES.REGIONAL_MANAGER }).ok).toBe(false);
  });
  test('FACTORY target without factoryId rejected', () => {
    expect(canInvite(sys, { level: LEVELS.FACTORY, role: ROLES.FACTORY_ADMIN }).ok).toBe(false);
  });
});

describe('permissions/invitations inviteScopeFor()', () => {
  test('sys-admin gets all levels, no scope constraint', () => {
    const s = inviteScopeFor({ role: ROLES.SYS_ADMIN, level: LEVELS.SYSTEM });
    expect(s.allowedLevels).toEqual([LEVELS.SYSTEM, LEVELS.NATIONAL, LEVELS.REGIONAL, LEVELS.FACTORY]);
    expect(s.regionId).toBeNull();
    expect(s.factoryId).toBeNull();
  });
  test('regional-manager gets regional+factory + own regionId', () => {
    const s = inviteScopeFor({ role: ROLES.REGIONAL_MANAGER, regionId: 'r1' });
    expect(s.allowedLevels).toEqual([LEVELS.REGIONAL, LEVELS.FACTORY]);
    expect(s.regionId).toBe('r1');
    expect(s.factoryId).toBeNull();
  });
  test('factory-admin gets factory only + own factoryId', () => {
    const s = inviteScopeFor({ role: ROLES.FACTORY_ADMIN, regionId: 'r1', factoryId: 'f1' });
    expect(s.allowedLevels).toEqual([LEVELS.FACTORY]);
    expect(s.factoryId).toBe('f1');
  });
  test('viewer cannot invite', () => {
    const s = inviteScopeFor({ role: ROLES.FACTORY_VIEWER });
    expect(s.allowedLevels).toEqual([]);
  });
});
