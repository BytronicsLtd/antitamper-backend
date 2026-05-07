const chalk = require("chalk");
const { default: mongoose } = require("mongoose");
const PDAModel = require("../../models/pda.model");
const DeviceModel = require("../../models/device.model");
const FactoryModel = require("../../models/factory.js");
const UnregisteredBTAttemptModel = require("../../models/unregistered-bt-attempt.model");
const ActivityModel = require("../../models/activityLog.js");
const formatValidationErrors = require("../../utils/formatValidationErrors.util");

const controller = {
    /**
     * Register PDA from a logged-in factory user.
     * Idempotent: if a PDA with the serial already exists for the user's factory, returns it as-is.
     * Creates in 'staging'; admin must approve via the existing /pda/:serial/approve endpoint.
     */
    register: async (req, res) => {
        const session = await mongoose.startSession();
        try {
            session.startTransaction();
            const { serial_number, device_info } = req.body;
            const user = req.user;

            if (!user.factory) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).send({
                    success: false,
                    message: "Your account has no factory associated; cannot register a PDA"
                });
            }

            const factory = await FactoryModel.findById(user.factory).session(session);
            if (!factory) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).send({
                    success: false,
                    message: "User factory not found"
                });
            }

            let pda = await PDAModel.findOne({ serial_number }).session(session);
            let created = false;

            if (pda) {
                // Idempotent re-register: if PDA belongs to the same factory, just return it.
                if (pda.factory && pda.factory.toString() === factory._id.toString()) {
                    if (device_info) {
                        pda.device_info = device_info;
                        await pda.save({ session });
                    }
                } else {
                    // Different factory (or unassigned) — refuse rather than steal it from another tenant.
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(409).send({
                        success: false,
                        message: "PDA serial already registered to a different factory"
                    });
                }
            } else {
                pda = new PDAModel({
                    serial_number,
                    factory: factory._id,
                    factory_name: factory.name,
                    factory_location: factory.location,
                    region: factory.region,
                    status: 'staging',
                    device_info: device_info || null,
                });
                await pda.save({ session });
                created = true;

                await ActivityModel.create([{
                    action: "register",
                    user: user.id,
                    email: user.email,
                    role: user.role,
                    timestamp: Date.now(),
                    model: "PDA",
                    affected_id: pda._id,
                    edited_data: {
                        status: 'staging',
                        serial_number: pda.serial_number,
                        factory_name: pda.factory_name
                    }
                }], { session });
            }

            await session.commitTransaction();
            session.endSession();

            res.status(created ? 201 : 200).send({
                success: true,
                message: created ? "PDA registered and pending approval" : "PDA already registered",
                results: pda
            });

        } catch (error) {
            console.log(chalk.red("Error registering PDA"), error);
            await session.abortTransaction();
            session.endSession();
            const status = error.code === 11000 ? 409 : 500;
            res.status(status).send({
                success: false,
                message: error.code === 11000 ? "PDA serial already registered" : error.message
            });
        }
    },

    /**
     * Get PDA status - Polling endpoint
     * Returns status and API key if approved
     */
    getStatus: async (req, res) => {
        try {
            const { serial } = req.params;

            if (!serial) {
                return res.status(400).send({
                    success: false,
                    message: "PDA serial number is required"
                });
            }

            const pda = await PDAModel.findOne({ serial_number: serial }).select('+api_key');

            if (!pda) {
                return res.status(404).send({
                    success: false,
                    status: 'unregistered',
                    message: "PDA not found"
                });
            }

            // Update last seen
            pda.last_seen_at = new Date();
            await pda.save();

            const response = {
                success: true,
                status: pda.status,
                factory_id: pda.factory,
                factory_name: pda.factory_name
            };

            // Include API key only if approved
            if (pda.status === 'approved' && pda.api_key) {
                response.api_key = pda.api_key;
            }

            res.status(200).send(response);

        } catch (error) {
            console.log(chalk.red("Error getting PDA status"), error);
            res.status(500).send({ success: false, message: error.message });
        }
    },

    /**
     * Get devices - Returns list of BT MACs for PDA's factory
     * Requires valid API key
     */
    getDevices: async (req, res) => {
        try {
            const { serial } = req.params;
            const pda = req.pda; // Set by pdaAuth middleware

            if (!pda) {
                return res.status(401).send({
                    success: false,
                    message: "Invalid or missing API key"
                });
            }

            // Get all active devices in PDA's factory with BT MAC
            const devices = await DeviceModel.find({
                factory: pda.factory,
                bluetooth_mac_address: { $ne: null, $exists: true },
                status: 'active',
                soft_deleted: { $ne: true }
            }).select('bluetooth_mac_address device_id company_id serial_number scale_model');

            res.status(200).send({
                success: true,
                factory_id: pda.factory,
                factory_name: pda.factory_name,
                // Return as 'results' array with 'bluetooth_mac_address' field for SDK compatibility
                results: devices.map(d => ({
                    id: d._id,
                    device_id: d.device_id,
                    bluetooth_mac_address: d.bluetooth_mac_address,
                    factory: pda.factory,
                    factory_name: pda.factory_name,
                    status: 'active',
                    company_id: d.company_id,
                    serial_number: d.serial_number,
                    scale_model: d.scale_model
                }))
            });

        } catch (error) {
            console.log(chalk.red("Error getting devices for PDA"), error);
            res.status(500).send({ success: false, message: error.message });
        }
    },

    /**
     * Approve PDA - Admin endpoint
     * Generates API key and sets status to approved
     */
    approve: async (req, res) => {
        const session = await mongoose.startSession();
        try {
            session.startTransaction();
            const { serial } = req.params;

            const pda = await PDAModel.findOne({ serial_number: serial }).select('+api_key');

            if (!pda) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).send({
                    success: false,
                    message: "PDA not found"
                });
            }

            if (pda.status === 'approved') {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).send({
                    success: false,
                    message: "PDA is already approved"
                });
            }

            // Generate API key
            const apiKey = pda.generateApiKey();
            pda.api_key = apiKey;
            pda.api_key_created_at = new Date();
            pda.status = 'approved';
            pda.approved_by = req.user.id;
            pda.approved_at = new Date();

            await pda.save({ session });

            // Log activity
            await ActivityModel.create([{
                action: "approve",
                user: req.user.id,
                email: req.user.email,
                role: req.user.role,
                timestamp: Date.now(),
                model: "PDA",
                affected_id: pda._id,
                edited_data: { status: 'approved', serial_number: pda.serial_number }
            }], { session });

            await session.commitTransaction();
            session.endSession();

            res.status(200).send({
                success: true,
                message: "PDA approved successfully",
                pda: {
                    serial_number: pda.serial_number,
                    status: pda.status,
                    factory_name: pda.factory_name,
                    approved_at: pda.approved_at
                }
            });

        } catch (error) {
            console.log(chalk.red("Error approving PDA"), error);
            await session.abortTransaction();
            session.endSession();
            res.status(500).send({ success: false, message: error.message });
        }
    },

    /**
     * Disable PDA - Admin endpoint
     */
    disable: async (req, res) => {
        const session = await mongoose.startSession();
        try {
            session.startTransaction();
            const { serial } = req.params;

            const pda = await PDAModel.findOne({ serial_number: serial });

            if (!pda) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).send({
                    success: false,
                    message: "PDA not found"
                });
            }

            pda.status = 'disabled';
            pda.api_key = null;
            await pda.save({ session });

            // Log activity
            await ActivityModel.create([{
                action: "disable",
                user: req.user.id,
                email: req.user.email,
                role: req.user.role,
                timestamp: Date.now(),
                model: "PDA",
                affected_id: pda._id,
                edited_data: { status: 'disabled', serial_number: pda.serial_number }
            }], { session });

            await session.commitTransaction();
            session.endSession();

            res.status(200).send({
                success: true,
                message: "PDA disabled successfully"
            });

        } catch (error) {
            console.log(chalk.red("Error disabling PDA"), error);
            await session.abortTransaction();
            session.endSession();
            res.status(500).send({ success: false, message: error.message });
        }
    },

    /**
     * Enable PDA - Admin endpoint (re-enable disabled PDA)
     */
    enable: async (req, res) => {
        const session = await mongoose.startSession();
        try {
            session.startTransaction();
            const { serial } = req.params;

            const pda = await PDAModel.findOne({ serial_number: serial }).select('+api_key');

            if (!pda) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).send({
                    success: false,
                    message: "PDA not found"
                });
            }

            if (pda.status !== 'disabled') {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).send({
                    success: false,
                    message: "PDA is not disabled"
                });
            }

            // Generate new API key
            const apiKey = pda.generateApiKey();
            pda.api_key = apiKey;
            pda.api_key_created_at = new Date();
            pda.status = 'approved';
            pda.approved_by = req.user.id;
            pda.approved_at = new Date();

            await pda.save({ session });

            // Log activity
            await ActivityModel.create([{
                action: "enable",
                user: req.user.id,
                email: req.user.email,
                role: req.user.role,
                timestamp: Date.now(),
                model: "PDA",
                affected_id: pda._id,
                edited_data: { status: 'approved', serial_number: pda.serial_number }
            }], { session });

            await session.commitTransaction();
            session.endSession();

            res.status(200).send({
                success: true,
                message: "PDA enabled successfully"
            });

        } catch (error) {
            console.log(chalk.red("Error enabling PDA"), error);
            await session.abortTransaction();
            session.endSession();
            res.status(500).send({ success: false, message: error.message });
        }
    },

    /**
     * Fetch many PDAs - Admin endpoint with pagination
     */
    fetchMany: async (req, res) => {
        try {
            let { search_term, status, factory, soft_deleted } = req.query;
            const user = req.user;

            let query = {
                soft_deleted: { $ne: true }
            };

            // Handle status filter
            if (status && ['staging', 'approved', 'disabled'].includes(status)) {
                query.status = status;
            }

            // Handle factory filter
            if (factory) {
                query.factory = factory;
            }

            // Handle soft_deleted for elevated roles
            const elevated_roles = ['root', 'sys-admin'];
            if (elevated_roles.includes(user.role) && soft_deleted) {
                if (soft_deleted === "true") query.soft_deleted = true;
                else if (soft_deleted === "false") query.soft_deleted = false;
                else if (soft_deleted === 'any') delete query.soft_deleted;
            }

            // Search query
            if (search_term) {
                query.$or = [
                    { serial_number: { $regex: new RegExp(search_term, "i") } },
                    { factory_name: { $regex: new RegExp(search_term, "i") } },
                    { region: { $regex: new RegExp(search_term, "i") } }
                ];
            }

            // Access control based on user level
            if (user.level === 'factory') {
                query.factory = user.factory;
            } else if (user.level === 'region') {
                query.region = user.region;
            }

            const { page, size } = req.query;
            const limit = size ? +size : 50;
            const offset = page ? (page - 1) * limit : 0;

            const results = await PDAModel.paginate(query, {
                page,
                limit,
                offset,
                sort: '-createdAt',
                populate: [
                    { path: 'factory', select: 'name location' },
                    { path: 'approved_by', select: 'name email' }
                ]
            });

            res.status(200).send({
                success: true,
                metadata: {
                    searchable_parameters: {
                        search_term: "String",
                        status: "staging|approved|disabled",
                        factory: "ObjectId"
                    }
                },
                results
            });

        } catch (error) {
            console.log(chalk.red("Error fetching PDAs"), error);
            res.status(500).send({ success: false, message: error.message });
        }
    },

    /**
     * Sync unregistered BT attempts - Batch upload from SDK
     */
    syncUnregisteredAttempts: async (req, res) => {
        try {
            const { attempts } = req.body;
            const pda = req.pda; // Set by pdaAuth middleware

            if (!pda) {
                return res.status(401).send({
                    success: false,
                    message: "Invalid or missing API key"
                });
            }

            if (!attempts || !Array.isArray(attempts)) {
                return res.status(400).send({
                    success: false,
                    message: "attempts array is required"
                });
            }

            // Create records for each attempt
            const records = attempts.map(attempt => ({
                mac_address: attempt.mac_address,
                pda_serial: pda.serial_number,
                pda: pda._id,
                factory: pda.factory,
                factory_name: pda.factory_name,
                attempted_at: attempt.attempted_at || new Date(),
                source: 'sync',
                synced_at: new Date()
            }));

            await UnregisteredBTAttemptModel.insertMany(records, { ordered: false });

            res.status(200).send({
                success: true,
                message: `${records.length} attempts logged`,
                synced_count: records.length
            });

        } catch (error) {
            console.log(chalk.red("Error syncing unregistered BT attempts"), error);
            // Handle duplicate key errors gracefully
            if (error.code === 11000) {
                res.status(200).send({
                    success: true,
                    message: "Some attempts were already synced"
                });
            } else {
                res.status(500).send({ success: false, message: error.message });
            }
        }
    },

    /**
     * Delete PDA - Admin endpoint (only staging PDAs)
     */
    delete: async (req, res) => {
        const session = await mongoose.startSession();
        try {
            session.startTransaction();
            const { serial } = req.params;

            const pda = await PDAModel.findOne({ serial_number: serial });

            if (!pda) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).send({
                    success: false,
                    message: "PDA not found"
                });
            }

            if (pda.status !== 'staging') {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).send({
                    success: false,
                    message: "Only staging PDAs can be deleted"
                });
            }

            await PDAModel.deleteOne({ _id: pda._id }, { session });

            // Log activity
            await ActivityModel.create([{
                action: "delete",
                user: req.user.id,
                email: req.user.email,
                role: req.user.role,
                timestamp: Date.now(),
                model: "PDA",
                affected_id: pda._id,
                deleted_data: { serial_number: pda.serial_number, factory_name: pda.factory_name }
            }], { session });

            await session.commitTransaction();
            session.endSession();

            res.status(200).send({
                success: true,
                message: "PDA deleted successfully"
            });

        } catch (error) {
            console.log(chalk.red("Error deleting PDA"), error);
            await session.abortTransaction();
            session.endSession();
            res.status(500).send({ success: false, message: error.message });
        }
    },

    /**
     * Unapprove/Decommission PDA - Admin endpoint
     * Moves approved PDA back to staging
     */
    unapprove: async (req, res) => {
        const session = await mongoose.startSession();
        try {
            session.startTransaction();
            const { serial } = req.params;

            const pda = await PDAModel.findOne({ serial_number: serial });

            if (!pda) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).send({
                    success: false,
                    message: "PDA not found"
                });
            }

            if (pda.status !== 'approved') {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).send({
                    success: false,
                    message: "Only approved PDAs can be unapproved"
                });
            }

            pda.status = 'staging';
            pda.api_key = null;
            pda.api_key_created_at = null;
            pda.approved_by = null;
            pda.approved_at = null;

            await pda.save({ session });

            // Log activity
            await ActivityModel.create([{
                action: "unapprove",
                user: req.user.id,
                email: req.user.email,
                role: req.user.role,
                timestamp: Date.now(),
                model: "PDA",
                affected_id: pda._id,
                edited_data: { status: 'staging', serial_number: pda.serial_number }
            }], { session });

            await session.commitTransaction();
            session.endSession();

            res.status(200).send({
                success: true,
                message: "PDA unapproved - moved back to staging"
            });

        } catch (error) {
            console.log(chalk.red("Error unapproving PDA"), error);
            await session.abortTransaction();
            session.endSession();
            res.status(500).send({ success: false, message: error.message });
        }
    },

    /**
     * Get unregistered BT attempts - Admin reporting endpoint
     */
    getUnregisteredAttempts: async (req, res) => {
        try {
            let { factory, pda_serial, start_date, end_date } = req.query;
            const user = req.user;

            let query = {};

            if (factory) query.factory = factory;
            if (pda_serial) query.pda_serial = pda_serial;

            if (start_date || end_date) {
                query.attempted_at = {};
                if (start_date) query.attempted_at.$gte = new Date(start_date);
                if (end_date) query.attempted_at.$lte = new Date(end_date);
            }

            // Access control
            if (user.level === 'factory') {
                query.factory = user.factory;
            } else if (user.level === 'region') {
                // Get factories in region, then filter
                const Factory = require("../../models/factory.js");
                const factories = await Factory.find({ region: user.region }).select('_id');
                query.factory = { $in: factories.map(f => f._id) };
            }

            const { page, size } = req.query;
            const limit = size ? +size : 50;
            const offset = page ? (page - 1) * limit : 0;

            const results = await UnregisteredBTAttemptModel.paginate(query, {
                page,
                limit,
                offset,
                sort: '-attempted_at'
            });

            res.status(200).send({
                success: true,
                results
            });

        } catch (error) {
            console.log(chalk.red("Error getting unregistered BT attempts"), error);
            res.status(500).send({ success: false, message: error.message });
        }
    }
};

module.exports = controller;
