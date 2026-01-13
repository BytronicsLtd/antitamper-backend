const chalk = require("chalk");
const DeviceModel = require("../../models/device.model");
const UserModel = require("../../models/user.js");
const FactoryModel = require("../../models/factory.js");
const ActivityModel = require("../../models/activityLog.js");
const PDAModel = require("../../models/pda.model");
const UnregisteredBTAttemptModel = require("../../models/unregistered-bt-attempt.model");
const { default: mongoose } = require("mongoose");
const formatValidationErrors = require("../../utils/formatValidationErrors.util");
const { addSeconds } = require("date-fns");
const scalesDumpModel = require("../../models/scales-dump.model.js");
const controller = {
  create: async (req, res) => {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const payload = req.body;
      console.log("create device payload ", payload);

      const device = new DeviceModel(payload)
      await ActivityModel.create([{
        action: "create", // edit, create, delete actions
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
      let {
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

      const users = await UserModel.find({ factory: device.factory }).select('email name phone_number role')
      res.status(200).send({ success: true, results: { device, users } });
    } catch (error) {
      console.log(chalk.red("Error fetching device details"), error);
      res.status(500).send({ success: false })
    }
  },
  update: async (req, res) => {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const id = req.body.id
      let { soft_deleted, ...data } = req.body
      let device = await DeviceModel.findById(id); // Use `findById` method
      if (!device) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).send({ success: false, message: 'Device not found' });
      }
      //fetch factory details if factory id is passed
      if (data.factory) {
        const factory = await FactoryModel.findById(data.factory);
        if (!factory) {
          await session.abortTransaction();
          session.endSession();
          return res.status(404).send({ success: false, message: "Factory not found" });
        }
        data.factory = factory.id;
        data.factory_name = factory.name;
        data.factory_location = factory.location
      }
      device = await DeviceModel.findByIdAndUpdate(id, {
        $set: data
      }, { runValidators: true, new: true }).session(session);
      // log the edit
      await ActivityModel.create([{
        action: "update", // edit, create, delete actions
        user: req.user.id, //user id performing the action
        email: req.user.email, //email of the user performinng the action
        role: req.user.role, //role of the user performing the action
        timestamp: Date.now(), // time the action was performed
        model: "Device", //data model affected by the action
        affected_id: device.id, //id of the item affected by the action
        deleted_data: null, // deleted data
        edited_data: device, // edited data
        created_data: null,// created data
      }], { session })
      await session.commitTransaction();
      session.endSession();
      res.status(200).send({ success: true, message: "Device updated successfully" })
    } catch (error) {
      console.log(chalk.red("Error fetching device details"), error);
      await session.abortTransaction();
      session.endSession();
      let errors = []
      if (error.name === 'ValidationError') {
        errors = formatValidationErrors(error.errors)
      }
      res.status(500).send({ success: false, error: error.message, errors })
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
  // verify scale - expanded to include PDA registration logic
  verifyScale: async (req, res) => {
    try {
      // Support both old format (bluetooth_mac_address) and new format (device.address)
      const bluetooth_mac_address = req.body.device?.address || req.body.bluetooth_mac_address;
      const pda_serial = req.body.pda_device?.serial;

      // Validate that bluetooth_mac_address is present and not empty
      if (!bluetooth_mac_address || bluetooth_mac_address.trim() === '') {
        return res.status(400).send({ success: false, message: "Bluetooth MAC address is required" });
      }

      // Save full request to scales-dump for analytics (always, regardless of validation result)
      await scalesDumpModel.findOneAndUpdate(
        { bluetooth_mac_address },
        { $set: { ...req.body, bluetooth_mac_address, last_seen: new Date() } },
        { upsert: true }
      );

      // Look up the BT device
      const scale = await DeviceModel.findOne({
        bluetooth_mac_address,
        soft_deleted: { $ne: true }
      });

      if (!scale) {
        // Log unregistered BT attempt if we have PDA serial
        if (pda_serial) {
          await UnregisteredBTAttemptModel.create({
            mac_address: bluetooth_mac_address,
            pda_serial,
            attempted_at: new Date(),
            source: 'online',
            device_info: req.body.device,
            pda_device_info: req.body.pda_device
          });
        }
        return res.status(404).send({
          success: false,
          status: 'bt_not_registered',
          message: "Bluetooth device not registered"
        });
      }

      if (scale.status === "inactive") {
        return res.status(401).send({
          success: false,
          status: 'device_inactive',
          message: "Scale is currently inactive"
        });
      }

      // Get the BT device's factory
      const btFactory = await FactoryModel.findById(scale.factory);

      // Base response with device info
      const response = {
        success: true,
        status: 'valid',
        results: {
          company_id: scale.company_id,
          factory_name: scale.factory_name,
          scale_model: scale.scale_model,
          device_id: scale.device_id,
          factory_id: btFactory?._id,
        },
        message: "Scale verified successfully"
      };

      // Check if invalid key was provided - put PDA in staging
      if (req.pdaKeyProvided && req.pdaKeyInvalid) {
        // Key was provided but invalid - find PDA by serial and put in staging
        if (pda_serial) {
          let pda = await PDAModel.findOne({ serial_number: pda_serial });
          if (pda) {
            pda.factory = btFactory._id;
            pda.factory_name = btFactory.name;
            pda.factory_location = btFactory.location;
            pda.region = btFactory.region;
            pda.status = 'staging';
            pda.api_key = null;
            pda.api_key_created_at = null;
            pda.approved_by = null;
            pda.approved_at = null;
            pda.device_info = req.body.pda_device;
            await pda.save();
          }
        }

        return res.status(401).send({
          success: false,
          status: 'invalid_key',
          pda_status: 'staging',
          pda_message: req.pdaKeyInvalidReason || 'Invalid API key - PDA moved to staging',
          results: response.results
        });
      }

      // Check if request has valid API key (set by optionalPdaAuth middleware)
      if (req.pda) {
        // PDA has valid API key - check factory match
        if (req.pda.factory.toString() !== scale.factory.toString()) {
          // Factory mismatch - BT device belongs to different factory
          // Move PDA to staging for the BT device's factory, revoke key
          req.pda.factory = btFactory._id;
          req.pda.factory_name = btFactory.name;
          req.pda.factory_location = btFactory.location;
          req.pda.region = btFactory.region;
          req.pda.status = 'staging';
          req.pda.api_key = null;
          req.pda.api_key_created_at = null;
          req.pda.approved_by = null;
          req.pda.approved_at = null;
          req.pda.device_info = req.body.pda_device;
          await req.pda.save();

          return res.status(200).send({
            success: true,
            status: 'factory_mismatch',
            pda_status: 'staging',
            pda_message: 'PDA moved to staging for new factory - key revoked',
            results: response.results
          });
        }

        // Same factory - all good
        response.pda_status = 'approved';
        response.pda_message = 'PDA approved';
        req.pda.last_seen_at = new Date();
        await req.pda.save();
      }
      // No valid API key - handle PDA registration/status based on pda_serial
      else if (pda_serial) {
        let pda = await PDAModel.findOne({ serial_number: pda_serial });

        if (!pda) {
          // Create new PDA in staging
          pda = new PDAModel({
            serial_number: pda_serial,
            factory: btFactory._id,
            factory_name: btFactory.name,
            factory_location: btFactory.location,
            region: btFactory.region,
            status: 'staging',
            device_info: req.body.pda_device
          });
          await pda.save();

          response.pda_status = 'staging';
          response.pda_message = 'PDA registered and pending approval';
        } else {
          // PDA exists but no valid key provided
          response.pda_status = pda.status;

          if (pda.status === 'approved') {
            response.pda_message = 'PDA approved - retrieve key from /pda/{serial}/status';
          } else if (pda.status === 'staging') {
            response.pda_message = 'PDA pending approval';
          } else if (pda.status === 'disabled') {
            response.pda_message = 'PDA is disabled';
          }

          // Check factory association
          if (!pda.factory || pda.factory.toString() !== btFactory._id.toString()) {
            // Different factory - move to staging
            pda.factory = btFactory._id;
            pda.factory_name = btFactory.name;
            pda.factory_location = btFactory.location;
            pda.region = btFactory.region;
            pda.status = 'staging';
            pda.api_key = null;
            pda.api_key_created_at = null;
            pda.approved_by = null;
            pda.approved_at = null;
            pda.device_info = req.body.pda_device;
            await pda.save();

            response.pda_status = 'staging';
            response.pda_message = 'PDA moved to staging for new factory';
          }

          pda.last_seen_at = new Date();
          await pda.save();
        }
      }

      res.status(200).send(response);
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
