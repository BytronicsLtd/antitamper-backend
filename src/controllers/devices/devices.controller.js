const chalk = require("chalk");
const DeviceModel = require("../../models/device.model");
const UserModel = require("../../models/user.js");
const FactoryModel = require("../../models/factory.js");
const ActivityModel = require("../../models/activityLog.js");
const { default: mongoose } = require("mongoose");
const formatValidationErrors = require("../../utils/formatValidationErrors.util");
const { addSeconds } = require("date-fns");
const controller = {
  create: async (req, res) => {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const payload = req.body;
      console.log("create device payload ", payload);

      const device = new DeviceModel(payload)
      await ActivityModel.create([{
        action: "delete", // edit, create, delete actions
        user: req.user.id, //user id performing the action
        email: req.user.email, //email of the user performinng the action
        role: req.user.role, //role of the user performing the action
        timestamp: Date.now(), // time the action was performed
        model: "Device", //data model affected by the action
        affected_id: device.id, //id of the item affected by the action
        deleted_data: device, // deleted data
        edited_data: null, // edited data
        created_data: null,// created data
      }], { session })
      await device.save(session)
      await session.commitTransaction();
      session.endSession();
      res.status(201).send({ success: true, device })
    } catch (error) {
      console.log(chalk.red("Error creating device"), error);
      await session.abortTransaction();
      session.endSession();
      let errors = []
      if (error.name === 'ValidationError') {
        errors = formatValidationErrors(error.errors)
      }
      res.status(500).send({ success: false, message: 'Error creating device', errors })

    }
  },
  //fetch many devices
  fetchMany: async (req, res) => {
    try {
      let = {
        search_term,
        soft_deleted
      } = req.query;
      const user = req.user;
      // handle soft delete
      let query = {
        soft_deleted: { $ne: true }
      };
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
            { device_id: { $regex: new RegExp(search_term, "i") } },
            { factory_name: { $regex: new RegExp(search_term, "i") } },
            { region: { $regex: new RegExp(search_term, "i") } },
            { serial_number: { $regex: new RegExp(search_term, "i") } },
            { phone_number: { $regex: new RegExp(search_term, "i") } },
            { status: { $regex: new RegExp(search_term, "i") } },
          ],
        };
      }
      query = {
        ...checkAccess({ query, req }),
      }
      const { page, size } = req.query;
      const limit = size ? +size : 100;
      const offset = page ? (page - 1) * limit : 0;
      const results = await DeviceModel.paginate(query, {
        page, limit, offset,
        select: ``,
        sort: '-createdAt',

      });
      // Add metadata for searchable parameters
      const metadata = {
        searchable_parameters: {
          "search_term": "String",
          "serial_number": "String",
          "phone_number": "String",
          "factory_name": "String",
          "factory_location": "String",
          "region": "String",
          "status": "String"
        }
      };
      res.status(200).send({ success: true, metadata, results });
    } catch (error) {
      console.log(chalk.red("Error fetching devices"), error);
      res.status(500).send({ success: false })
    }
  },
  // fetch  device details
  getOne: async (req, res) => {
    try {
      const id = req.query.id
      let device = await DeviceModel.findById(id)
      device = device?.toJSON()
      if (!device) return res.status(404).send({ success: false, message: 'Device not found' });
      console.log("devices =============== = ", device);

      const users = await UserModel.find({ factory: device.factory }).select('email name phone_number role')
      res.status(200).send({ success: true, results: { device, users } });
    } catch (error) {
      console.log(chalk.red("Error fetching device details"), error);
      res.status(500).send({ success: false })
    }
  },
  update: async (req, res) => {
    try {
      const id = req.body.id
      let { soft_deleted, ...data } = req.body
      let device = await DeviceModel.findById(id); // Use `findById` method
      if (!device) return res.status(404).send({ success: false, message: 'Device not found' });
      //fetch factory details if factory id is passed
      if (data.factory) {
        const factory = await FactoryModel.findById(data.factory);
        if (!factory) return res.status(404).send({ success: true, message: "Factory not found" });
        data.factory = factory.id;
        data.factory_name = factory.name;
        data.factory_location = factory.location
      }
      device = await DeviceModel.findByIdAndUpdate(id, {
        $set: data
      }, { runValidators: true, new: true })
      res.status(200).send({ success: true, message: "Device updated successfully" })
    } catch (error) {
      console.log(chalk.red("Error fetching device details"), error);
      res.status(500).send({ success: false, error: error.message })
    }
  },
  // remove 
  remove: async (req, res) => {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const id = req.body.id;
      let device = await DeviceModel.findById(id);

      if (!device) {
        return res
          .status(404)
          .send({ success: false, message: "Device with given ID not found" });
      }

      await ActivityModel.create(
        [
          {
            action: "delete", // edit, create, delete actions
            user: req.user.id, //user id performing the action
            email: req.user.email, //email of the user performinng the action
            role: req.user.role, //role of the user performing the action
            timestamp: Date.now(), // time the action was performed
            model: "Device", //data model affected by the action
            affected_id: device.id, //id of the item affected by the action
            deleted_data: device, // deleted data
            edited_data: null, // edited data
            created_data: null, // created data
          },
        ],
        { session }
      );
      // delete
      device = await DeviceModel.findByIdAndDelete(device.id).session(session);
      await session.commitTransaction();
      session.endSession();
      res.status(200).send({
        success: true,
        message: "Device successfully deleted",
        results: device,
      });
    } catch (error) {
      console.log(chalk.red("Error deleting device"), error);
      await session.abortTransaction();
      session.endSession();
      res.status(500).send({ success: false, error: error.message });
    }
  },
  // get time for device
  getTime: async (req, res) => {
    try {
      const date = addSeconds(new Date(), 3);
      res.status(200).send({
        success: true,
        cmd: "SET_TIME",
        timestamp: [
          date.getUTCFullYear(),
          date.getUTCMonth() + 1,
          date.getUTCDate(),
          date.getUTCHours(),
          date.getUTCMinutes(),
          date.getUTCSeconds(),
        ],
      });
    } catch (error) {
      console.log(chalk.red("Error sending time to device"), error);
      res.status(500).send({ success: false, error: error.message });
    }
  },
  // get time for device
  getCompanyID: async (req, res) => {
    try {
      const device_id = req.body.device_id;
      const device = await DeviceModel.findOne({ device_id });
      if (!device) {
        return res.status(404).send({ success: false });
      }
      res.status(200).send({ success: true, company_id: device.company_id });
    } catch (error) {
      console.log(chalk.red("Error fetching device company id"), error);
      res.status(500).send({ success: false, error: error.message });
    }
  },
  // verify scale
  verifyScale: async (req, res) => {
    try {
      const bluetooth_mac_address = req.body.scale_id;
      console.log("verify body ", req.body);

      const approved_scales = [
        { bluetooth_mac_address: "0F:03:24:92:10:69", company_id: "BWS-0001" },
        { bluetooth_mac_address: "0F:03:24:92:10:53", company_id: "BWS-0002" },
      ]
      const scale = await DeviceModel.findOne({ bluetooth_mac_address });
      // const scale = approved_scales.find((scale) => scale.bluetooth_mac_address == bluetooth_mac_address)
      if (!scale) {
        return res.status(404).send({ success: false });
      }
      res.status(200).send({ success: true, scale });
    } catch (error) {
      console.log(chalk.red("Error verifying scale "), error);
      res.status(500).send({ success: false, error: error.message });
    }
  },
};

module.exports = controller;

// check access
function checkAccess({ query, req }) {
  const user = req.user;
  const role = user.role;
  const level = user.level;
  const factory = user.factory;
  const region = user.region;
  // filter by factory
  if (level === "factory") {
    query.factory = factory;
  }
  // filter by region
  if (level === "region") {
    query.region = region;
  }
  return query;
}
