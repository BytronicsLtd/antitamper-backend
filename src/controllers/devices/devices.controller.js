const chalk = require("chalk");
const DeviceModel = require("../../models/device.model")


const controller = {
    create: async (req, res) => {
        try {
            const payload = req.body;
            console.log("device  payload ", payload)
         
            res.status(201).send({ success: true, cmd: 15 })
        } catch (error) {
            console.log(chalk.red("Error creating device"), error);
            res.status(500).send({ success: false })

        }
    },
    //fetch many devices
    fetchMany: async (req, res) => {
       try{

        } catch (error) {
            console.log(chalk.red("Error fetching devices"), error);
            res.status(500).send({ success: false })
        }
    },
    // fetch  device details
    getOne: async (req, reply)=>{
        try {
            
        } catch (error) {
            console.log(chalk.red("Error fetching device details"), error);
            res.status(500).send({ success: false })
        }
    }
}

module.exports = controller;