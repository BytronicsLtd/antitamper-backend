const { default: mongoose } = require("mongoose");
const chalk = require("chalk");
const ActivityModel = require('../../models/activityLog.js');
const UserModel = require("../../models/user");
const { getVisibleRegionIds, isSysAdmin } = require('../../utils/testRegionFilter.util.js');
const { parseMongoError } = require("../../utils/mongoErrorHandler.util.js");
const { isLevel, LEVELS, canInvite } = require('../../permissions');

// Fields a user is NOT allowed to change about themselves — only an admin
// with the right scope can flip role/level/status/region/factory.
const PRIVILEGED_FIELDS = ['role', 'level', 'status', 'soft_deleted', 'region', 'factory'];

function asString(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (v._bsontype === 'ObjectId') return v.toString();
  return String(v);
}

// Authorisation gate for modifying or deleting an existing user. Mirrors
// the invite matrix: if you can invite someone at this level/role/region/
// factory, you can manage them.
function canManageUser(actor, target) {
  return canInvite(actor, {
    level: target.level,
    role: target.role,
    regionId: asString(target.region),
    factoryId: asString(target.factory),
  });
}
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

    const target = await UserModel.findById(id).lean();
    if (!target) return res.status(404).send({ success: false, message: "User not found" });

    const isSelf = asString(target._id) === asString(req.user.id || req.user._id);
    const update = { ...rest };

    if (isSelf) {
      // Self-edit: strip privileged fields. A user can't promote themselves
      // or flip their own status. Use the dedicated /users/settings endpoint
      // for self-settings only.
      for (const f of PRIVILEGED_FIELDS) delete update[f];
    } else {
      const result = canManageUser(req.user, target);
      if (!result.ok) {
        return res.status(403).send({
          success: false,
          message: `You cannot manage this user: ${result.reason}`,
        });
      }
    }

    // If status is moving away from "active" (or soft_deleted is being set),
    // also clear the stored token so any open sessions are dropped on the
    // next request even before the auth-status check kicks in.
    const deactivating =
      (Object.prototype.hasOwnProperty.call(update, 'status') && update.status && update.status !== 'active') ||
      update.soft_deleted === true;
    if (deactivating) {
      update.token = null;
    }

    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: id },
      { $set: update },
      { new: true },
    );
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
      await session.abortTransaction();
      session.endSession();
      return res.status(404).send({ success: false, message: "User with given ID not found" });
    }

    const isSelf = asString(user._id) === asString(req.user.id || req.user._id);
    if (isSelf) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).send({ success: false, message: "You cannot delete your own account" });
    }

    const result = canManageUser(req.user, user);
    if (!result.ok) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).send({
        success: false,
        message: `You cannot delete this user: ${result.reason}`,
      });
    }

    await ActivityModel.create([{
      action: "delete",
      user: req.user.id,
      email: req.user.email,
      role: req.user.role,
      timestamp: Date.now(),
      model: "User",
      affected_id: user.id,
      deleted_data: user,
      edited_data: null,
      created_data: null,
    }], { session });
    // delete
    user = await UserModel.findByIdAndDelete(id).session(session);
    await session.commitTransaction();
    session.endSession();
    res.status(200).send({ success: true, message: "User successfully deleted", results: user });
  } catch (error) {
    console.log(chalk.red("Error deleting user"), error);
    await session.abortTransaction();
    session.endSession();
    res.status(500).send({ success: false, error: error.message });
  }
};

// check access - now async to support test region filtering
async function checkAccess({ query, req }) {
  const user = req.user;
  // Use isLevel (handles legacy lowercase + canonical UPPERCASE) — direct
  // string compare on user.level was missing freshly invited users whose
  // level is canonically "REGIONAL"/"FACTORY" and silently widening their
  // scope.
  if (isLevel(user, LEVELS.FACTORY) && user.factory) {
    query.factory = user.factory;
    return query;
  }
  if (isLevel(user, LEVELS.REGIONAL) && user.region) {
    query.region = user.region;
    return query;
  }
  if (isSysAdmin(user)) {
    return query;
  }
  // National-level non-elevated (Manager / ICT Manager): restrict to
  // visible regions, but keep users without a region (admins/peers) visible —
  // user accounts often have no region even when they should be listable.
  const regionIds = await getVisibleRegionIds(user);
  query.$or = [
    { region: { $in: regionIds } },
    { region: { $exists: false } },
    { region: null },
  ];
  return query;
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