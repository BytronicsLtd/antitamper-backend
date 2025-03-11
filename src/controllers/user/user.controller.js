const { default: mongoose } = require("mongoose");
const ActivityModel = require('../../models/activityLog.js');
const UserModel = require("../../models/user");
// Retrieve all users
exports.getUsers = async (req, res) => {
  try {
    let = {
      email_confirmed,
      search_term,
    } = req.query;
    let query = {
      soft_deleted: { $ne: true }
    };
    // ---------------------- search query  ------------------------
    if (search_term) {
      query = {
        ...query,
        $or: [
          { name: { $regex: new RegExp(search_term, "i") } },
          { email: { $regex: new RegExp(search_term, "i") } },
          { region: { $regex: new RegExp(search_term, "i") } },
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
    const { page, size } = req.query;
    const limit = size ? +size : 100;
    const offset = page ? (page - 1) * limit : 0;
    const results = await UserModel.paginate(query, {
      page, limit, offset,
      select: `name email phone_number email_confirmed role status can_receive_sms_alerts can_receive_email_alerts`,
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
    const id = req.query.id
    const user = await UserModel.findById(id)
      .select('name email phone_number email_confirmed role status user')
      .populate([
        { path: 'factory', select: "name location", transform: (doc) => doc?.toJSON() || doc }
      ])
    if (!user) return res.status(404).send({ success: false, message: "UserModel not found" });
    res.status(200).send({ success: true, results: user });
  } catch (err) {
    res.status(500).send({ success: false, message: "Error retrieving user", error: err.message });
  }
};

// Update user details
exports.updateUser = async (req, res) => {
  try {
    const { password, id, ...rest } = req.body
    const updatedUser = await UserModel.findByIdAndUpdate(id, {
      $set: rest
    }, { new: true });
    if (!updatedUser) return res.status(404).send({ success: false, message: "UserModel not found" });
    res.status(200).send({ success: true, results: updatedUser });
  } catch (err) {
    res.status(500).send({ success: false, message: "Error updating user", error: err.message });
  }
};

// Soft delete a user
exports.remove = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const id = req.body.id;
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
    device = await UserModel.findByIdAndUpdate(id, {
      $set: {
        soft_deleted: true
      }
    }, { runValidators: true, new: true }).session(session)
    await session.commitTransaction();
    session.endSession();
    res.status(200).send({ success: true, message: "User successfully deleted", results: device })
  } catch (error) {
    console.log(chalk.red("Error deleting device"), error);
    await session.abortTransaction();
    session.endSession();
    res.status(500).send({ success: false, error: error.message })
  }
};
