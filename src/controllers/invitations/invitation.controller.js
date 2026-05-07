const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const chalk = require('chalk');

const InvitationModel = require('../../models/invitation.model');
const UserModel = require('../../models/user');
const FactoryModel = require('../../models/factory');
const RegionModel = require('../../models/region.model');

const emailSender = require('../../utils/communication/email/email.util');
const { envelope, fail, gate, logActivity } = require('../../utils/crudFactory');
const {
  LEVELS,
  canInvite,
  inviteScopeFor,
} = require('../../permissions');

const TOKEN_TTL_DAYS = 7;

const generateToken = () => crypto.randomBytes(32).toString('hex');
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');
const asString = (v) => (v == null ? null : typeof v === 'string' ? v : String(v));
const frontendBaseUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173';

function expiryDate() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + TOKEN_TTL_DAYS);
  return d;
}

async function describeScope({ level, region, factory }) {
  const parts = [level];
  if (region) {
    const r = await RegionModel.findById(region).lean();
    if (r) parts.push(r.name || r.code || asString(region));
  }
  if (factory) {
    const f = await FactoryModel.findById(factory).lean();
    if (f) parts.push(f.name || asString(factory));
  }
  return parts.join(' · ');
}

const controller = {
  /**
   * POST /api/v1/invitations
   * Body: { email, role, level, regionId?, factoryId? }
   *
   * Bespoke (vs CRUD factory) because: needs canInvite() rather than the
   * generic users:write gate, scope cross-check against Factory.region,
   * email send, and uniqueness-vs-pending guard.
   */
  create: async (req, res) => {
    try {
      const inviter = req.user;
      const { email, role, level, regionId = null, factoryId = null } = req.body || {};

      if (!email || !role || !level) {
        return fail(res, 400, 'email, role and level are required');
      }

      const ok = canInvite(inviter, { role, level, regionId, factoryId });
      if (!ok.ok) return fail(res, 403, `Cannot send invite: ${ok.reason}`);

      // Cross-check factory belongs to inviter's region (when scoped).
      if (level === LEVELS.FACTORY) {
        const f = await FactoryModel.findById(factoryId).lean();
        if (!f) return fail(res, 400, 'factoryId does not exist');
        const scope = inviteScopeFor(inviter);
        if (scope.regionId && asString(f.region) !== asString(scope.regionId)) {
          return fail(res, 403, 'factory is outside your region');
        }
      }
      if (level === LEVELS.REGIONAL) {
        const r = await RegionModel.findById(regionId).lean();
        if (!r) return fail(res, 400, 'regionId does not exist');
      }

      const existingActive = await InvitationModel.findOne({
        email: email.toLowerCase(),
        status: 'pending',
        expiresAt: { $gt: new Date() },
      }).lean();
      if (existingActive) {
        return fail(res, 409, 'There is already a pending invitation for this email. Revoke it first.');
      }
      const existingUser = await UserModel.findOne({ email: email.toLowerCase() }).lean();
      if (existingUser) return fail(res, 409, 'A user with that email already exists');

      const rawToken = generateToken();
      const invitation = await InvitationModel.create({
        email: email.toLowerCase(),
        role,
        level,
        region: level === LEVELS.REGIONAL || level === LEVELS.FACTORY ? regionId : null,
        factory: level === LEVELS.FACTORY ? factoryId : null,
        tokenHash: hashToken(rawToken),
        expiresAt: expiryDate(),
        invitedBy: inviter.id || inviter._id,
        status: 'pending',
      });

      // Backfill region from factory if not supplied (factory invites).
      if (level === LEVELS.FACTORY && !invitation.region && factoryId) {
        const f = await FactoryModel.findById(factoryId).lean();
        if (f?.region) {
          invitation.region = f.region;
          await invitation.save();
        }
      }

      const acceptUrl = `${frontendBaseUrl()}/accept-invite?token=${rawToken}`;
      const scope = await describeScope({ level, region: invitation.region, factory: invitation.factory });

      try {
        await emailSender({
          template: 'invitation.handlebars',
          emails: email.toLowerCase(),
          subject: 'You have been invited to Bytronics Antitamper',
          payload: {
            inviterName: inviter.name || inviter.email,
            email: email.toLowerCase(),
            role,
            scope,
            acceptUrl,
            expiresAt: invitation.expiresAt.toUTCString(),
          },
        });
      } catch (mailErr) {
        console.log(chalk.yellow('Invitation saved but email send failed:'), mailErr.message);
      }

      await logActivity(req, 'create', 'Invitation', invitation, {
        created_data: { email: invitation.email, role, level },
      });

      res.status(201).send(envelope(invitation));
    } catch (err) {
      console.log(chalk.red('Error creating invitation'), err);
      fail(res, 500, err.message);
    }
  },

  /**
   * GET /api/v1/invitations
   * Returns invitations within the caller's invite scope.
   *
   * Doesn't use the generic CRUD factory.list because the scope rule is
   * "what the caller can invite into", not "what their level filters to".
   */
  list: async (req, res) => {
    try {
      if (!gate(req, res, 'users:read')) return;
      const inviter = req.user;
      const scope = inviteScopeFor(inviter);
      if (scope.allowedLevels.length === 0) {
        return fail(res, 403, 'You cannot view invitations');
      }

      const query = {};
      if (scope.factoryId) query.factory = scope.factoryId;
      else if (scope.regionId) query.region = scope.regionId;

      const { status, page, size } = req.query;
      if (status) query.status = status;

      const results = await InvitationModel.paginate(query, {
        page: page ? +page : 1,
        limit: size ? +size : 50,
        sort: '-createdAt',
        populate: [
          { path: 'invitedBy', select: 'name email' },
          { path: 'region', select: 'name code' },
          { path: 'factory', select: 'name location' },
        ],
      });
      res.status(200).send(envelope(results));
    } catch (err) {
      console.log(chalk.red('Error listing invitations'), err);
      fail(res, 500, err.message);
    }
  },

  /**
   * DELETE /api/v1/invitations/:id  — revoke a pending invitation.
   */
  revoke: async (req, res) => {
    try {
      const inviter = req.user;
      const inv = await InvitationModel.findById(req.params.id);
      if (!inv) return fail(res, 404, 'Invitation not found');

      const ownInvite = asString(inv.invitedBy) === asString(inviter.id || inviter._id);
      const stillOk = canInvite(inviter, {
        level: inv.level,
        role: inv.role,
        regionId: inv.region,
        factoryId: inv.factory,
      }).ok;
      if (!ownInvite && !stillOk) return fail(res, 403, 'You cannot revoke this invitation');
      if (inv.status !== 'pending') return fail(res, 400, `Invitation already ${inv.status}`);

      inv.status = 'revoked';
      await inv.save();

      await logActivity(req, 'delete', 'Invitation', inv);
      res.status(200).send(envelope(inv));
    } catch (err) {
      console.log(chalk.red('Error revoking invitation'), err);
      fail(res, 500, err.message);
    }
  },

  /**
   * GET /api/v1/invitations/accept?token=...   — public preview endpoint.
   */
  preview: async (req, res) => {
    try {
      const token = req.query?.token;
      if (!token) return fail(res, 400, 'token required');

      const inv = await InvitationModel.findOne({ tokenHash: hashToken(token) }).lean();
      if (!inv) return fail(res, 404, 'Invalid invitation');
      if (inv.status !== 'pending') return fail(res, 410, `Invitation ${inv.status}`);
      if (inv.expiresAt < new Date()) return fail(res, 410, 'Invitation expired');

      res.status(200).send(envelope({
        email: inv.email,
        role: inv.role,
        level: inv.level,
        expiresAt: inv.expiresAt,
      }));
    } catch (err) {
      console.log(chalk.red('Error previewing invitation'), err);
      fail(res, 500, err.message);
    }
  },

  /**
   * POST /api/v1/invitations/accept
   * Public. Body: { token, name, phone_number, password }.
   */
  accept: async (req, res) => {
    try {
      const { token, name, phone_number, password } = req.body || {};
      if (!token || !name || !phone_number || !password) {
        return fail(res, 400, 'token, name, phone_number and password are required');
      }
      if (password.length < 8) return fail(res, 400, 'password must be at least 8 characters');

      const inv = await InvitationModel.findOne({ tokenHash: hashToken(token) });
      if (!inv) return fail(res, 404, 'Invalid invitation');
      if (inv.status !== 'pending') return fail(res, 410, `Invitation ${inv.status}`);
      if (inv.expiresAt < new Date()) {
        inv.status = 'expired';
        await inv.save();
        return fail(res, 410, 'Invitation expired');
      }

      const exists = await UserModel.findOne({ email: inv.email });
      if (exists) return fail(res, 409, 'Email already registered');

      const hashed = await bcrypt.hash(password, 10);
      const userPayload = {
        name,
        email: inv.email,
        phone_number,
        password: hashed,
        role: inv.role,
        level: inv.level,
        email_confirmed: true,
      };
      if (inv.level === LEVELS.REGIONAL) userPayload.region = inv.region;
      if (inv.level === LEVELS.FACTORY) userPayload.factory = inv.factory;

      const user = await UserModel.create(userPayload);

      const authToken = jwt.sign(
        { id: user._id, email: user.email, role: user.role },
        process.env.SECRET_KEY,
        { expiresIn: '24h' }
      );
      user.token = authToken;
      await user.save({ validateBeforeSave: false });

      inv.status = 'accepted';
      inv.acceptedAt = new Date();
      inv.acceptedUser = user._id;
      await inv.save();

      res.status(200).send({
        success: true,
        token: authToken,
        results: { id: user._id, email: user.email, role: user.role, level: user.level },
      });
    } catch (err) {
      console.log(chalk.red('Error accepting invitation'), err);
      fail(res, 500, err.message);
    }
  },
};

module.exports = controller;
