const { buildApp } = require('../helpers/app');
const { createTestUser, createTestFactory } = require('../helpers/testData');
const RegionModel = require('../../src/models/region.model');
const InvitationModel = require('../../src/models/invitation.model');
const UserModel = require('../../src/models/user');
const { LEVELS, ROLES } = require('../../src/permissions');

let app;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

async function inject(method, url, { token, payload, query } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return app.inject({ method, url, headers, payload, query });
}

describe('Invitations API', () => {
  describe('POST /api/v1/invitations', () => {
    it('rejects without auth', async () => {
      const r = await inject('POST', '/api/v1/invitations/', { payload: {} });
      expect(r.statusCode).toBe(401);
    });

    it('sys-admin can invite a regional-manager into any region', async () => {
      const { token } = await createTestUser();
      const region = await RegionModel.create({ name: 'R1', code: '1' });
      const r = await inject('POST', '/api/v1/invitations/', {
        token,
        payload: {
          email: 'invitee@test.com',
          role: ROLES.REGIONAL_MANAGER,
          level: LEVELS.REGIONAL,
          regionId: region._id.toString(),
        },
      });
      expect(r.statusCode).toBe(201);
      const body = JSON.parse(r.payload);
      expect(body.success).toBe(true);
      expect(body.results.email).toBe('invitee@test.com');
      expect(body.results.status).toBe('pending');
    });

    it('regional-manager cannot invite into a different region', async () => {
      const r1 = await RegionModel.create({ name: 'R1', code: '1' });
      const r2 = await RegionModel.create({ name: 'R2', code: '2' });
      const { token } = await createTestUser({
        role: ROLES.REGIONAL_MANAGER,
        level: LEVELS.REGIONAL,
        region: r1._id,
      });
      const r = await inject('POST', '/api/v1/invitations/', {
        token,
        payload: {
          email: 'cross@test.com',
          role: ROLES.REGIONAL_VIEWER,
          level: LEVELS.REGIONAL,
          regionId: r2._id.toString(),
        },
      });
      expect(r.statusCode).toBe(403);
    });

    it('factory-admin can invite into own factory only', async () => {
      const region = await RegionModel.create({ name: 'R1', code: '1' });
      const fac = await createTestFactory({ region: region._id });
      const { token } = await createTestUser({
        role: ROLES.FACTORY_ADMIN,
        level: LEVELS.FACTORY,
        factory: fac._id,
        region: region._id,
      });
      const r = await inject('POST', '/api/v1/invitations/', {
        token,
        payload: {
          email: 'fellow@test.com',
          role: ROLES.FACTORY_VIEWER,
          level: LEVELS.FACTORY,
          factoryId: fac._id.toString(),
        },
      });
      expect(r.statusCode).toBe(201);
    });

    it('viewer cannot invite anyone', async () => {
      const region = await RegionModel.create({ name: 'R1', code: '1' });
      const { token } = await createTestUser({
        role: ROLES.REGIONAL_VIEWER,
        level: LEVELS.REGIONAL,
        region: region._id,
      });
      const r = await inject('POST', '/api/v1/invitations/', {
        token,
        payload: {
          email: 'nope@test.com',
          role: ROLES.REGIONAL_VIEWER,
          level: LEVELS.REGIONAL,
          regionId: region._id.toString(),
        },
      });
      expect(r.statusCode).toBe(403);
    });

    it('rejects duplicate pending invitation for the same email', async () => {
      const region = await RegionModel.create({ name: 'R1', code: '1' });
      const { token } = await createTestUser();
      const payload = {
        email: 'dupe@test.com',
        role: ROLES.REGIONAL_VIEWER,
        level: LEVELS.REGIONAL,
        regionId: region._id.toString(),
      };
      const first = await inject('POST', '/api/v1/invitations/', { token, payload });
      expect(first.statusCode).toBe(201);
      const second = await inject('POST', '/api/v1/invitations/', { token, payload });
      expect(second.statusCode).toBe(409);
    });
  });

  describe('GET /api/v1/invitations/accept', () => {
    it('returns 404 for unknown token', async () => {
      const r = await inject('GET', '/api/v1/invitations/accept', { query: { token: 'bogus' } });
      expect(r.statusCode).toBe(404);
    });

    it('returns 410 for expired invitation', async () => {
      const region = await RegionModel.create({ name: 'R1', code: '1' });
      const { token } = await createTestUser();
      const created = await inject('POST', '/api/v1/invitations/', {
        token,
        payload: {
          email: 'late@test.com',
          role: ROLES.REGIONAL_VIEWER,
          level: LEVELS.REGIONAL,
          regionId: region._id.toString(),
        },
      });
      const invId = JSON.parse(created.payload).results.id;
      // Expire it directly
      await InvitationModel.findByIdAndUpdate(invId, { expiresAt: new Date(Date.now() - 1000) });
      // Need the raw token — for testing, regenerate one and rehash
      const fakeToken = 'expiredfake';
      const crypto = require('crypto');
      await InvitationModel.findByIdAndUpdate(invId, {
        tokenHash: crypto.createHash('sha256').update(fakeToken).digest('hex'),
      });
      const r = await inject('GET', '/api/v1/invitations/accept', { query: { token: fakeToken } });
      expect(r.statusCode).toBe(410);
    });
  });

  describe('POST /api/v1/invitations/accept', () => {
    it('creates a User and returns auth token', async () => {
      // Spoof a known-token invitation by writing the row directly
      const crypto = require('crypto');
      const region = await RegionModel.create({ name: 'R1', code: '1' });
      const inviter = await UserModel.create({
        name: 'Admin',
        email: 'admin@test.com',
        password: 'x',
        role: ROLES.SYS_ADMIN,
        level: LEVELS.SYSTEM,
        phone_number: '254700000000',
      });
      const rawToken = 'unittesttoken_' + Date.now();
      await InvitationModel.create({
        email: 'newbie@test.com',
        role: ROLES.REGIONAL_MANAGER,
        level: LEVELS.REGIONAL,
        region: region._id,
        tokenHash: crypto.createHash('sha256').update(rawToken).digest('hex'),
        expiresAt: new Date(Date.now() + 86400000),
        invitedBy: inviter._id,
        status: 'pending',
      });

      const r = await inject('POST', '/api/v1/invitations/accept', {
        payload: {
          token: rawToken,
          name: 'Newbie User',
          phone_number: '254700111222',
          password: 'longenough123',
        },
      });
      expect(r.statusCode).toBe(200);
      const body = JSON.parse(r.payload);
      expect(body.success).toBe(true);
      expect(body.token).toBeTruthy();
      expect(body.results.email).toBe('newbie@test.com');
      expect(body.results.role).toBe(ROLES.REGIONAL_MANAGER);
      expect(body.results.level).toBe(LEVELS.REGIONAL);

      // The user is in the DB
      const user = await UserModel.findOne({ email: 'newbie@test.com' });
      expect(user).toBeTruthy();
      expect(user.region.toString()).toBe(region._id.toString());

      // Invitation marked accepted
      const invs = await InvitationModel.find({ email: 'newbie@test.com' });
      expect(invs[0].status).toBe('accepted');
    });

    it('rejects short password', async () => {
      const r = await inject('POST', '/api/v1/invitations/accept', {
        payload: { token: 'x', name: 'a', phone_number: '254700000000', password: 'short' },
      });
      expect(r.statusCode).toBe(400);
    });
  });
});
