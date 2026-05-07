const { default: mongoose } = require("mongoose");
const chalk = require("chalk");
const ActivityModel = require('../../models/activityLog.js');
const UserModel = require("../../models/user");
const { getVisibleRegionIds, applyRegionFilter } = require('../../utils/testRegionFilter.util.js');
const { parseMongoError } = require("../../utils/mongoErrorHandler.util.js");
const { isLevel, LEVELS } = require('../../permissions');
// Retrieve all users
exports.getUsers = async (req, res) => {
  try {
    let {
      email_confirmed,
      search_term,
      soft_deleted
    } = req.query;
    const user = req.user;
    // handle soft delete
    let query = {
      soft_deleted: { $ne: true }
    };
    if (isLevel(user, LEVELS.FACTORY)) {
      query.factory = user.factory
    }
    // add query for elevated roles
    const elevated_roles = ['root', 'sys-admin']
    if (elevated_roles.includes(user.role) && soft_deleted) {
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
          { email: { $regex: new RegExp(search_term, "i") } },
          { phone_number: { $regex: new RegExp(search_term, "i") } },
          { status: { $regex: new RegExp(search_term, "i") } },
          { role: { $regex: new RegExp(search_term, "i") } },
          { level: { $regex: new RegExp(search_term, "i") } },
        ],
      };
    }
    if (email_confirmed) {
      query.email_confirmed = email_confirmed === "false" ? false : true
    }
    query = {
      ...(await checkAccess({ query, req })),
    }
    const { page, size } = req.query;
    const limit = size ? +size : 100;
    const offset = page ? (page - 1) * limit : 0;
    const results = await UserModel.paginate(query, {
      page, limit, offset,
      select: `name email phone_number email_confirmed role status can_receive_sms_alerts can_receive_email_alerts soft_deleted factory level region designation`,
      sort: '-createdAt',
    });
    // Add metadata for searchable parameters
    const metadata = {
      searchable_parameters: {
        "name": "String",
        "email": "String",
        "phone_number": "String",
        "email_confirmed": "true|false",
        "role": "String",
        "status": "String",
        "level": "String",
      }
    };
    res.status(200).send({ success: true, metadata, results });
  } catch (err) {
    res.status(500).send({ success: false, message: "Error retrieving users", error: err.message });
  }
};
// get me
exports.getMe = async (req, res) => {
  try {
    const id = req.user.id
    const user = await UserModel.findById(id)
      .select('-password -token')
      .populate([
        { path: 'factory', select: "name location", transform: (doc) => doc?.toJSON() || doc }
      ])
    if (!user) return res.status(404).send({ message: "UserModel not found" });
    res.status(200).send({ success: true, results: user });
  } catch (err) {
    res.status(500).send({ success: false, message: "Error retrieving your details", error: err.message });
  }
}
// Retrieve a specific user by ID
exports.getUserById = async (req, res) => {
  try {
    const id = req.params.id;
    const user = await UserModel.findById(id)
      .select('-password -token ')
      .populate([
        { path: 'factory', select: "name location", transform: (doc) => doc?.toJSON() || doc }
      ])
    if (!user) return res.status(404).send({ success: false, message: "User not found" });
    res.status(200).send({ success: true, results: user });
  } catch (err) {
    res.status(500).send({ success: false, message: "Error retrieving user details", error: err.message });
  }
};

// Update user details
exports.updateUser = async (req, res) => {
  try {
    const id = req.params.id;
    const { password, ...rest } = req.body;

    let query = {
      _id: id,
    }
    const updatedUser = await UserModel.findOneAndUpdate(query, {
      $set: rest
    }, { new: true });
    if (!updatedUser) return res.status(404).send({ success: false, message: "User not found" });
    res.status(200).send({ success: true, results: updatedUser });
  } catch (err) {
    const { status, message } = parseMongoError(err);
    res.status(status).send({ success: false, message });
  }
};

// Soft delete a user
exports.remove = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const id = req.params.id;
    let user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).send({ success: false, message: "User with given ID not found" })
    }

    await ActivityModel.create([{
      action: "delete", // edit, create, delete actions
      user: req.user.id, //user id performing the action
      email: req.user.email, //email of the user performinng the action
      role: req.user.role, //role of the user performing the action
      timestamp: Date.now(), // time the action was performed
      model: "User", //data model affected by the action
      affected_id: user.id, //id of the item affected by the action
      deleted_data: user, // deleted data
      edited_data: null, // edited data
      created_data: null,// created data
    }], { session })
    // delete
    user = await UserModel.findByIdAndDelete(id).session(session)
    await session.commitTransaction();
    session.endSession();
    res.status(200).send({ success: true, message: "User successfully deleted", results: user })
  } catch (error) {
    console.log(chalk.red("Error deleting user"), error);
    await session.abortTransaction();
    session.endSession();
    res.status(500).send({ success: false, error: error.message })
  }
};

// check access - now async to support test region filtering
async function checkAccess({ query, req }) {
  const user = req.user;
  if (user.level === "factory" && user.factory) {
    query.factory = user.factory;
    return query;
  }
  if (user.level === "region" && user.region) {
    query.region = user.region;
    return query;
  }
  const regionIds = await getVisibleRegionIds(user);
  return applyRegionFilter(query, regionIds);
}

// Update user settings
exports.updateSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    // Backwards-compat: accept either showTestData (new) or showTestRegions (old).
    const showTestData = req.body.showTestData ?? req.body.showTestRegions;

    if (showTestData !== undefined) {
      if (!['root', 'sys-admin'].includes(req.user.role)) {
        return res.status(403).send({
          success: false,
          message: "Only system administrators can modify this setting"
        });
      }
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      { $set: { 'settings.showTestData': !!showTestData } },
      { new: true }
    ).select('-password -token');

    res.status(200).send({ success: true, results: updatedUser });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: 'Error updating settings',
      error: error.message
    });
  }
};