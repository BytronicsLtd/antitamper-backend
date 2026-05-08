/**
 * Generic CRUD controller factory — emits Fastify-shaped handlers for a
 * Mongoose model with permission and scope enforcement baked in.
 *
 * Usage:
 *
 *   const RegionModel = require('../models/region.model');
 *   const crud = crudFactory({
 *     Model: RegionModel,
 *     resource: 'regions',                  // for can() lookups + activity log
 *     scopeFields: { region: 'region' },    // optional; how the model carries scope
 *     populate: [{ path: 'whatever' }],     // optional default populate
 *     hooks: {                              // optional lifecycle hooks
 *       beforeCreate: async (payload, req) => payload,
 *       afterCreate:  async (doc, req) => {},
 *       beforeUpdate: async (patch, doc, req) => patch,
 *       beforeRemove: async (doc, req) => {},
 *     },
 *   });
 *
 *   // Now register them as routes:
 *   app.get('/api/v1/regions/',     { preHandler: [authenticate] }, crud.list);
 *   app.get('/api/v1/regions/:id',  { preHandler: [authenticate] }, crud.get);
 *   app.post('/api/v1/regions/',    { preHandler: [authenticate] }, crud.create);
 *   app.patch('/api/v1/regions/:id',{ preHandler: [authenticate] }, crud.update);
 *   app.delete('/api/v1/regions/:id',{ preHandler: [authenticate] }, crud.remove);
 *
 * Each handler:
 *   - Gates with can(req.user.role, `${resource}:${verb}`).
 *   - Applies scopeFilter(req.user, scopeFields) on list (so REGIONAL/FACTORY
 *     users see only their slice).
 *   - Verifies inScope(req.user, doc) on get/update/remove (404 vs 403).
 *   - Writes an ActivityModel entry on create/update/remove.
 *   - Returns the standard envelope { success, results, message? }.
 *
 * Bespoke logic is added via hooks (or by writing a custom handler that
 * still uses can()/inScope() for consistency).
 */

const chalk = require('chalk');
const { can, inScope, scopeFilter } = require('../permissions');
const ActivityModel = require('../models/activityLog');

const NOOP = async (x) => x;

function envelope(payload, extra = {}) {
  return { success: true, ...extra, ...(payload !== undefined ? { results: payload } : {}) };
}

function fail(res, status, message, extra = {}) {
  return res.status(status).send({ success: false, message, ...extra });
}

function gate(req, res, action) {
  if (!can(req.user?.role, action)) {
    fail(res, 403, 'You do not have permission to perform this action');
    return false;
  }
  return true;
}

async function logActivity(req, action, model, doc, payload = {}) {
  try {
    await ActivityModel.create({
      action,
      user: req.user.id || req.user._id,
      email: req.user.email,
      role: req.user.role,
      timestamp: Date.now(),
      model,
      affected_id: doc?._id || doc?.id || null,
      ...payload,
    });
  } catch (err) {
    console.log(chalk.yellow(`activity log failed (${model}.${action}):`), err.message);
  }
}

function crudFactory({
  Model,
  resource,
  scopeFields = {},
  populate = [],
  hooks = {},
  pageSize = 50,
}) {
  if (!Model) throw new Error('crudFactory requires Model');
  if (!resource) throw new Error('crudFactory requires resource');

  const beforeCreate = hooks.beforeCreate || NOOP;
  const afterCreate = hooks.afterCreate || NOOP;
  const beforeUpdate = hooks.beforeUpdate || (async (patch) => patch);
  const afterUpdate = hooks.afterUpdate || NOOP;
  const beforeRemove = hooks.beforeRemove || NOOP;

  const modelLabel = Model.modelName || resource;

  const list = async (req, res) => {
    try {
      if (!gate(req, res, `${resource}:read`)) return;

      let filter = scopeFilter(req.user, scopeFields);
      if (filter._scopeReject) {
        return res.status(200).send({ success: true, results: { docs: [], totalDocs: 0, page: 1 } });
      }

      // Lightweight query string filters: keys that exactly match a model
      // schema path get applied. Skip pagination knobs.
      const reserved = new Set(['page', 'size', 'limit', 'offset', 'sort', 'search_term']);
      for (const [k, v] of Object.entries(req.query || {})) {
        if (reserved.has(k)) continue;
        if (Model.schema.path(k)) filter[k] = v;
      }

      const limit = req.query?.size ? +req.query.size : pageSize;
      const page = req.query?.page ? +req.query.page : 1;

      const results = await Model.paginate(filter, {
        page,
        limit,
        sort: req.query?.sort || '-createdAt',
        populate,
      });
      res.status(200).send(envelope(results));
    } catch (err) {
      console.log(chalk.red(`error listing ${resource}`), err);
      fail(res, 500, err.message);
    }
  };

  const get = async (req, res) => {
    try {
      if (!gate(req, res, `${resource}:read`)) return;
      const doc = await Model.findById(req.params.id).populate(populate);
      if (!doc) return fail(res, 404, `${modelLabel} not found`);
      if (!inScope(req.user, doc)) return fail(res, 404, `${modelLabel} not found`);
      res.status(200).send(envelope(doc));
    } catch (err) {
      console.log(chalk.red(`error getting ${resource}`), err);
      fail(res, 500, err.message);
    }
  };

  const create = async (req, res) => {
    try {
      if (!gate(req, res, `${resource}:write`)) return;
      let payload = await beforeCreate(req.body || {}, req);
      const doc = await Model.create(payload);
      await afterCreate(doc, req);
      await logActivity(req, 'create', modelLabel, doc, { created_data: payload });
      res.status(201).send(envelope(doc));
    } catch (err) {
      console.log(chalk.red(`error creating ${resource}`), err);
      fail(res, err.name === 'ValidationError' ? 400 : 500, err.message);
    }
  };

  const update = async (req, res) => {
    try {
      if (!gate(req, res, `${resource}:write`)) return;
      const doc = await Model.findById(req.params.id);
      if (!doc) return fail(res, 404, `${modelLabel} not found`);
      if (!inScope(req.user, doc)) return fail(res, 404, `${modelLabel} not found`);

      const patch = await beforeUpdate(req.body || {}, doc, req);
      Object.assign(doc, patch);
      await doc.save();
      await afterUpdate(doc, req);
      await logActivity(req, 'edit', modelLabel, doc, { edited_data: patch });
      res.status(200).send(envelope(doc));
    } catch (err) {
      console.log(chalk.red(`error updating ${resource}`), err);
      fail(res, err.name === 'ValidationError' ? 400 : 500, err.message);
    }
  };

  const remove = async (req, res) => {
    try {
      if (!gate(req, res, `${resource}:write`)) return;
      const doc = await Model.findById(req.params.id);
      if (!doc) return fail(res, 404, `${modelLabel} not found`);
      if (!inScope(req.user, doc)) return fail(res, 404, `${modelLabel} not found`);
      await beforeRemove(doc, req);

      // Soft-delete if the model carries a soft_deleted flag, otherwise hard.
      if (Model.schema.path('soft_deleted')) {
        doc.soft_deleted = true;
        await doc.save();
      } else {
        await doc.deleteOne();
      }
      await logActivity(req, 'delete', modelLabel, doc, { deleted_data: doc.toObject?.() || doc });
      res.status(200).send(envelope(doc, { message: `${modelLabel} removed` }));
    } catch (err) {
      console.log(chalk.red(`error removing ${resource}`), err);
      fail(res, 500, err.message);
    }
  };

  return { list, get, create, update, remove };
}

module.exports = crudFactory;
module.exports.envelope = envelope;
module.exports.fail = fail;
module.exports.gate = gate;
module.exports.logActivity = logActivity;
