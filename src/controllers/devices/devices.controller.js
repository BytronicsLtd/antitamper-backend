const chalk = require("chalk");
const DeviceModel = require("../../models/device.model")


const controller = {
    create: async (req, res) => {
        try {
            const payload = req.body;
            console.log("device  payload ", payload)
            const device = new DeviceModel(payload)
            await device.save()
            res.status(201).send({ success: true, device })
        } catch (error) {
            console.log(chalk.red("Error creating device"), error);
            res.status(500).send({ success: false, message: 'Error creating device', error: error.message })

        }
    },
    //fetch many devices
    fetchMany: async (req, res) => {
        try {
            let query = {};
            const { page, size } = req.query;
            const limit = size ? +size : 100;
            const offset = page ? (page - 1) * limit : 0;
            const results = await DeviceModel.paginate(query, {
                page, limit, offset,
                select: ``,
                sort: '-createdAt',

            });
            res.status(200).send(results);
        } catch (error) {
            console.log(chalk.red("Error fetching devices"), error);
            res.status(500).send({ success: false })
        }
    },
    // fetch  device details
    getOne: async (req,res) => {
        try {
            const id = req.query.id
            const factory = await DeviceModel.findById(id); // Use `findById` method
            if (!factory) return res.status(404).send({ message: 'Factory not found' });
            res.status(200).send(factory);
        } catch (error) {
            console.log(chalk.red("Error fetching device details"), error);
            res.status(500).send({ success: false })
        }
    }
}

module.exports = controller;