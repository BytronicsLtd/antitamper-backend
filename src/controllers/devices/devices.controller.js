const chalk = require("chalk");
const DeviceModel = require("../../models/device.model")
const UserModel = require("../../models/user.js")
const FactoryModel = require('../../models/factory.js');
const ActivityModel = require('../../models/activityLog.js');
const { default: mongoose } = require("mongoose");

const controller = {
    create: async (req, res) => {
        const session = await mongoose.startSession();
        try {
            session.startTransaction();
            const payload = req.body;
            console.log("device  payload ", payload)
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
            res.status(500).send({ success: false, message: 'Error creating device', error: error.message })

        }
    },
    //fetch many devices
    fetchMany: async (req, res) => {
        try {
            let query = {
                soft_deleted: { $ne: true }
            };
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
                    "device_id": "String",
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
        } catch (error) {
            console.log(chalk.red("Error fetching device details"), error);
            res.status(500).send({ success: false, error: error.message })
        }
    },
    // remove 
    remove: async (req, res) => {
        const session = await mongoose.startSession();
        try {
            const id = req.body.id;
            let device = await DeviceModel.findById(id);
            console.log("Found device to delete ", device);
            session.startTransaction();
            if (!device) {
                return res.status(404).send({ success: false, message: "Device with given ID not found" })
            }

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
            // delete
            device = await DeviceModel.findByIdAndUpdate(id, {
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
}

module.exports = controller;