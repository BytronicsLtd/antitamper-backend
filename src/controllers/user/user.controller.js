const User = require("../../models/user");
const { default: mongoose } = require("mongoose");

// Retrieve all users
exports.getUsers = async (req,res) => {
  try {
     let query = {};
     const { page, size } = req.query;
     const limit = size ? +size : 100;
     const offset = page ? (page - 1) * limit : 0;
     const results = await User.paginate(query, {
       page, limit, offset,
       select: `name email phone_number email_confirmed role status factory`,
       sort: '-createdAt',
       populate:[
        {path:'factory', select:"name location", transform: (doc) => doc?.toJSON() || doc}
       ]
 
     });
     res.status(200).send(results);
  } catch (err) {
    res.status(500).send({ success:false, message: "Error retrieving users", error: err.message });
  }
};

// Retrieve a specific user by ID
exports.getUserById = async (req,res) => {
  try {
    const id = req.query.id
    const user = await User.findById(id)
    .select('name email phone_number email_confirmed role status factory')
    .populate([
      {path:'factory', select:"name location", transform: (doc) => doc?.toJSON() || doc}
    ])
    if (!user) return res.status(404).send({ message: "User not found" });
    res.send(user);
  } catch (err) {
    res.status(500).send({ message: "Error retrieving user", error: err.message });
  }
};

// Update user details
exports.updateUser = async (req,res) => {
  try {
    const {password,id, ...rest} = req.body
    const updatedUser = await User.findByIdAndUpdate(id, {
      $set: rest
    }, { new: true });
    if (!updatedUser) return res.status(404).send({ message: "User not found" });
    res.send(updatedUser);
  } catch (err) {
    res.status(500).send({ message: "Error updating user", error: err.message });
  }
};

// Soft delete a user
exports.deleteUser = async (req,res) => {
  try {
    const deletedUser = await User.findByIdAndUpdate(req.params.userId, { status: "Inactive" }, { new: true });
    if (!deletedUser) return res.status(404).send({ message: "User not found" });
    res.send(deletedUser);
  } catch (err) {
    res.status(500).send({ message: "Error deleting user", error: err.message });
  }
};
