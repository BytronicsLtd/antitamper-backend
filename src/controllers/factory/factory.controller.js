const chalk = require("chalk");
const { default: mongoose } = require("mongoose");
const ActivityModel = require('../../models/activityLog.js');
const FactoryModel = require('../../models/factory.js');
const RegionModel = require('../../models/region.model.js');
const formatValidationErrors = require("../../utils/formatValidationErrors.util.js");
const { parseMongoError } = require("../../utils/mongoErrorHandler.util.js");
const { getVisibleRegionIds, applyRegionFilter, canAccessRegion } = require('../../utils/testRegionFilter.util.js');
const { isLevel, LEVELS } = require('../../permissions');

// Create a new factory
async function createFactory(req, res) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // Regional users can only create factories in their own region;
    // force it server-side regardless of what the body says.
    if (isLevel(req.user, LEVELS.REGIONAL) && req.user.region) {
      req.body.region = String(req.user.region);
    }

    if (!req.body.region || !mongoose.Types.ObjectId.isValid(req.body.region)) {
      return res.status(400).send({ success: false, message: "A valid region id is required" });
    }
    const region = await RegionModel.findById(req.body.region);
    if (!region) {
      return res.status(400).send({ success: false, message: "Region not found" });
    }
    if (!(await canAccessRegion(req.user, region._id))) {
      return res.status(403).send({ success: false, message: "You cannot create a factory in this region" });
    }
    let query = { name: req.body.name, location: req.body.location };
    const results = await FactoryModel.findOne(query)
    if (results) {
      return res.status(400).send({ success: false, message: "Factory with given details already exists", results });
    }
    const factory = new FactoryModel(req.body);
    // 
    await factory.save({ session });
    await ActivityModel.create([{
      action: "create", // edit, create, delete actions
      user: req.user.id, //user id performing the action
      email: req.user.email, //email of the user performinng the action
      role: req.user.role, //role of the user performing the action
      timestamp: Date.now(), // time the action was performed
      model: "Factory", //data model affected by the action
      affected_id: factory.id, //id of the item affected by the action
      deleted_data: null, // deleted data
      edited_data: null, // edited data
      created_data: factory,// created data
    }], { session });
    await session.commitTransaction();
    session.endSession();
    res.status(201).send({ success: true, message: "Factory created successfully" });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    const { status, message } = parseMongoError(error);
    res.status(status).send({ success: false, message });
  }
}

// Retrieve all factories
async function getFactories(req, res) {
  try {
    let {
      search_term,
      soft_deleted,
      region,
    } = req.query;
    const user = req.user;
    let query = {
      soft_deleted: { $ne: true }
    };

    // Note: a region filter is applied *after* checkAccess below, because
    // checkAccess overwrites `query.region` with the caller's visible
    // regions and would otherwise clobber the requested filter.

    if (user.role === 'sys-admin' && soft_deleted) {
      if (soft_deleted === "true") {
        query.soft_deleted = true;
      }
      if (soft_deleted === "false") {
        query.soft_deleted = false;
      }
      if (soft_deleted === 'any') {
        delete query.soft_deleted
      }
    }
    // ---------------------- search query  ------------------------
    if (search_term) {
      query = {
        ...query,
        $or: [
          { name: { $regex: new RegExp(search_term, "i") } },
          { location: { $regex: new RegExp(search_term, "i") } },
        ],
      };
    }
    query = {
      ...(await checkAccess({ query, req })),
    }

    // Apply the caller-requested region filter, intersected with the set
    // checkAccess just allowed. If the requested region isn't in the
    // visible set, force an empty result rather than leaking the broader
    // list.
    if (region && mongoose.Types.ObjectId.isValid(region)) {
      const allowed = query.region;
      const requestedStr = String(region);
      let permitted = false;
      if (Array.isArray(allowed?.$in)) {
        permitted = allowed.$in.map(String).includes(requestedStr);
      } else if (allowed) {
        permitted = String(allowed) === requestedStr;
      } else {
        permitted = true; // FACTORY-scoped user — region wasn't applied
      }
      query.region = permitted ? region : new mongoose.Types.ObjectId();
    }
    const { page, size } = req.query;
    const limit = size ? +size : 100;
    const offset = page ? (page - 1) * limit : 0;
    const results = await FactoryModel.paginate(query, {
      page, limit, offset,
      select: ``,
      sort: '-createdAt',
      populate: { path: 'region', select: 'name code isTest' },
    });
    const metadata = {
      searchable_parameters: {
        "name": "String",
        "location": "String",
        "region": "String",
      }
    };
    res.status(200).send({ success: true, metadata, results });
  } catch (error) {
    console.log(chalk.red('Error retrieving factories'), error);
    
    res.status(500).send({ success: false, message: 'Error retrieving factories', error: error.message });
  }
}

// Retrieve a specific factory by ID
async function getFactoryById(req, res) {
  try {
    const id = req.params.id;
    const factory = await FactoryModel.findById(id);
    if (!factory) return res.status(404).send({ message: 'FactoryModel not found' });
    res.status(200).send({ success: true, results: factory });
  } catch (err) {
    res.status(500).send({ success: false, message: 'Error retrieving factory', error: err.message });
  }
}

// Update factory details
async function updateFactory(req, res) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const id = req.params.id;
    let { soft_deleted, ...data } = req.body;

    // Load the existing factory and verify the caller can act on its region.
    const existing = await FactoryModel.findById(id);
    if (!existing) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).send({ success: false, message: "Factory not found" });
    }
    if (!(await canAccessRegion(req.user, existing.region))) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).send({ success: false, message: "You cannot update this factory" });
    }

    // Regional users can't move a factory out of their region — silently
    // strip the field so the existing region is preserved.
    if (isLevel(req.user, LEVELS.REGIONAL)) {
      delete data.region;
    } else if (data.region !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(data.region)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).send({ success: false, message: "A valid region id is required" });
      }
      const region = await RegionModel.findById(data.region);
      if (!region) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).send({ success: false, message: "Region not found" });
      }
      if (!(await canAccessRegion(req.user, region._id))) {
        await session.abortTransaction();
        session.endSession();
        return res.status(403).send({ success: false, message: "You cannot move this factory to that region" });
      }
    }

    const factory = await FactoryModel.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true },
    ).session(session);
    if (!factory) return res.status(404).send({ message: 'factory not found' });
    await ActivityModel.create([{
      action: "edit", // edit, create, delete actions
      user: req.user.id, //user id performing the action
      email: req.user.email, //email of the user performinng the action
      role: req.user.role, //role of the user performing the action
      timestamp: Date.now(), // time the action was performed
      model: "Factory", //data model affected by the action
      affected_id: factory.id, //id of the item affected by the action
      deleted_data: null, // deleted data
      edited_data: factory, // edited data
      created_data: null,// created data
    }], { session });
    await session.commitTransaction();
    session.endSession();
    res.status(200).send({ success: true, results: factory });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    const { status, message } = parseMongoError(err);
    res.status(status).send({ success: false, message });
  }
}

// Deactivate a factory
async function remove(req, res) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const id = req.params.id;
    let factory = await FactoryModel.findById(id);
    if (!factory) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).send({ success: false, message: "Factory with given ID not found" });
    }

    if (!(await canAccessRegion(req.user, factory.region))) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).send({ success: false, message: "You cannot delete this factory" });
    }

    await ActivityModel.create([{
      action: "delete", // edit, create, delete actions
      user: req.user.id, //user id performing the action
      email: req.user.email, //email of the user performinng the action
      role: req.user.role, //role of the user performing the action
      timestamp: Date.now(), // time the action was performed
      model: "Factory", //data model affected by the action
      affected_id: factory.id, //id of the item affected by the action
      deleted_data: factory, // deleted data
      edited_data: null, // edited data
      created_data: null,// created data
    }], { session })
    // delete
    factory = await FactoryModel.findByIdAndUpdate(id, {
      $set: {
        soft_deleted: true
      }
    }, { runValidators: true, new: true }).session(session)
    await session.commitTransaction();
    session.endSession();
    res.status(200).send({ success: true, message: "Factory successfully deleted", results: factory })
  } catch (error) {
    console.log(chalk.red("Error deleting device"), error);
    await session.abortTransaction();
    session.endSession();
    res.status(500).send({ success: false, error: error.message })
  }
}

// Export all functions
module.exports = {
  createFactory,
  getFactories,
  getFactoryById,
  updateFactory,
  remove
};
async function checkAccess({ query, req }) {
  const user = req.user;
  // Use isLevel — raw user.level === "region" was missing canonical
  // "REGIONAL" (used by freshly invited users), letting them fall through
  // to the broader visibility filter and see all non-test factories.
  if (isLevel(user, LEVELS.FACTORY) && user.factory) {
    query._id = user.factory;
    return query;
  }
  if (isLevel(user, LEVELS.REGIONAL) && user.region) {
    query.region = user.region;
    return query;
  }
  const regionIds = await getVisibleRegionIds(user);
  return applyRegionFilter(query, regionIds);
}