const chalk = require("chalk");
const { default: mongoose } = require("mongoose");
const ActivityModel = require('../../models/activityLog.js');
const FactoryModel = require('../../models/factory.js');

// Create a new factory
async function createFactory(req, res) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const factory = new FactoryModel(req.body);
    const savedFactory = await factory.save({ session });
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
    res.status(201).send(savedFactory);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).send({ message: 'Error creating factory', error: err.message });
  }
}

// Retrieve all factories
async function getFactories(req, res) {
  try {
    let query = {
      soft_deleted: { $ne: true }
    };
    const { page, size } = req.query;
    const limit = size ? +size : 100;
    const offset = page ? (page - 1) * limit : 0;
    const results = await FactoryModel.paginate(query, {
      page, limit, offset,
      select: ``,
      sort: '-createdAt',

    });
    res.status(200).send({ success: true, results });
  } catch (err) {
    res.staus(500).send({ success: false, message: 'Error retrieving factories', error: err.message });
  }
}

// Retrieve a specific factory by ID
async function getFactoryById(req, res) {
  try {
    const id = req.query.id
    const factory = await FactoryModel.findById(id); // Use `findById` method
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
    let { soft_deleted, ...data } = req.body
    const factory = await FactoryModel.findByIdAndUpdate(
      req.body.id,
      {
        $set: data
      },
      { new: true } // Return the updated document
    ).session(session);
    if (!factory) return res.status(404).send({ message: 'FactoryModel not found' });
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
    res.status(500).send({ success: false, message: 'Error updating factory', error: err.message });
  }
}

// Deactivate a factory
async function remove(req, res) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const id = req.body.id;
    let factory = await FactoryModel.findById(id);
    if (!factory) {
      return res.status(404).send({ success: false, message: "Factory with given ID not found" })
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
    device = await FactoryModel.findByIdAndUpdate(id, {
      $set: {
        soft_deleted: true
      }
    }, { runValidators: true, new: true }).session(session)
    await session.commitTransaction();
    session.endSession();
    res.status(200).send({ success: true, message: "Device successfully deleted", results: device })
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