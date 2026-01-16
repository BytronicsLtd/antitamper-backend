const chalk = require("chalk");
const { default: mongoose } = require("mongoose");
const ActivityModel = require('../../models/activityLog.js');
const RegionModel = require('../../models/region.model.js');
const { buildRegionVisibilityQuery } = require('../../utils/testRegionFilter.util.js');
const formatValidationErrors = require("../../utils/formatValidationErrors.util.js");
const { parseMongoError } = require("../../utils/mongoErrorHandler.util.js");

// Create a new region
async function createRegion(req, res) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { name, isTest } = req.body;

    // Check if region already exists (case-insensitive)
    const existing = await RegionModel.findOne({ name })
      .collation({ locale: 'en', strength: 2 });
    if (existing) {
      return res.status(409).send({
        success: false,
        message: "A record with this name already exists"
      });
    }

    const region = new RegionModel({ name, isTest: isTest || false });
    await region.save({ session });

    await ActivityModel.create([{
      action: "create",
      user: req.user.id,
      email: req.user.email,
      role: req.user.role,
      timestamp: Date.now(),
      model: "Region",
      affected_id: region.id,
      deleted_data: null,
      edited_data: null,
      created_data: region,
    }], { session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).send({
      success: true,
      message: "Region created successfully",
      results: region
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    const { status, message } = parseMongoError(error);
    res.status(status).send({
      success: false,
      message
    });
  }
}

// Fetch all regions with visibility filtering
async function getRegions(req, res) {
  try {
    const user = req.user;
    const { search_term, soft_deleted } = req.query;

    // Build base query with visibility rules
    let query = buildRegionVisibilityQuery(user);

    // Handle soft_deleted filter for sys-admins
    if (['root', 'sys-admin'].includes(user.role) && soft_deleted) {
      if (soft_deleted === "true") {
        query.soft_deleted = true;
      } else if (soft_deleted === "false") {
        query.soft_deleted = false;
      } else if (soft_deleted === 'any') {
        delete query.soft_deleted;
      }
    }

    // Search filter
    if (search_term) {
      query = {
        ...query,
        name: { $regex: new RegExp(search_term, "i") }
      };
    }

    const { page, size } = req.query;
    const limit = size ? +size : 100;
    const offset = page ? (page - 1) * limit : 0;

    const results = await RegionModel.paginate(query, {
      page,
      limit,
      offset,
      sort: 'name'
    });

    const metadata = {
      searchable_parameters: {
        "name": "String"
      }
    };

    res.status(200).send({ success: true, metadata, results });
  } catch (error) {
    console.log(chalk.red('Error retrieving regions'), error);
    res.status(500).send({
      success: false,
      message: 'Error retrieving regions',
      error: error.message
    });
  }
}

// Get region by ID
async function getRegionById(req, res) {
  try {
    const id = req.params.id;
    const region = await RegionModel.findById(id);

    if (!region) {
      return res.status(404).send({
        success: false,
        message: 'Region not found'
      });
    }

    res.status(200).send({ success: true, results: region });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: 'Error retrieving region',
      error: error.message
    });
  }
}

// Update a region
async function updateRegion(req, res) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const id = req.params.id;
    const { soft_deleted, ...data } = req.body;

    // Check if name is being updated and if it conflicts with another region (case-insensitive)
    if (data.name) {
      const existing = await RegionModel.findOne({
        name: data.name,
        _id: { $ne: id }
      }).collation({ locale: 'en', strength: 2 });

      if (existing) {
        await session.abortTransaction();
        session.endSession();
        return res.status(409).send({
          success: false,
          message: "A record with this name already exists"
        });
      }
    }

    const region = await RegionModel.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true }
    ).session(session);

    if (!region) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).send({
        success: false,
        message: 'Region not found'
      });
    }

    await ActivityModel.create([{
      action: "edit",
      user: req.user.id,
      email: req.user.email,
      role: req.user.role,
      timestamp: Date.now(),
      model: "Region",
      affected_id: region.id,
      deleted_data: null,
      edited_data: data,
      created_data: null,
    }], { session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).send({ success: true, results: region });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    const { status, message } = parseMongoError(error);
    res.status(status).send({
      success: false,
      message
    });
  }
}

// Soft delete a region
async function removeRegion(req, res) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const id = req.params.id;

    let region = await RegionModel.findById(id);
    if (!region) {
      return res.status(404).send({
        success: false,
        message: "Region with given ID not found"
      });
    }

    await ActivityModel.create([{
      action: "delete",
      user: req.user.id,
      email: req.user.email,
      role: req.user.role,
      timestamp: Date.now(),
      model: "Region",
      affected_id: region.id,
      deleted_data: region,
      edited_data: null,
      created_data: null,
    }], { session });

    region = await RegionModel.findByIdAndUpdate(
      id,
      { $set: { soft_deleted: true } },
      { runValidators: true, new: true }
    ).session(session);

    await session.commitTransaction();
    session.endSession();

    res.status(200).send({
      success: true,
      message: "Region successfully deleted",
      results: region
    });
  } catch (error) {
    console.log(chalk.red("Error deleting region"), error);
    await session.abortTransaction();
    session.endSession();
    res.status(500).send({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  createRegion,
  getRegions,
  getRegionById,
  updateRegion,
  removeRegion
};
