const chalk = require("chalk");
const DataModel = require("../../models/data.model");
const UserModel = require("../../models/user");
const DeviceModel = require("../../models/device.model");

const MQTTClient = require("../../config/mqtt.conf");
const { checkAlert } = require("./checkAlerts.js")
const mqtt_client = new MQTTClient({})
const controller = {
    updateScaleStatus: async (req, res) => {
        try {
            const payload = req.body;

            // find device details
            const device = await DeviceModel.findOne({ device_id: payload.device_id })
                .populate([
                    { path: 'factory', transform: (doc) => doc?.toJSON() || doc, }
                ])
            if (!device) {
                return res.status(404).send({ success: false })
            }


            //fetch users that belong to the same factory as the device
            let users = await UserModel.find({
                $or: [
                    { role: "sys-admin" },
                    {
                        $and: [
                            { factory: device?.factory?.id },
                            {
                                $or: [
                                    { can_receive_email_alerts: true },
                                    { can_receive_sms_alerts: true }
                                ]
                            }
                        ]
                    }
                ]
            }).select("-_id email phone_number can_receive_email_alerts can_receive_sms_alerts role factory");
            const last_entry = await DataModel.findOne({ device_id: payload.device_id }).sort({ createdAt: -1 });

            //
            let { gps_lat, gps_lon, gsm_lat, gsm_lon, gps_datetime, gsm_datetime, rtc_datetime } = payload;
            let data = {
                ...payload,
                factory: device?.factory?.id,
                factory_name: device?.factory?.name,
                factory_location: device?.factory?.location,
            }
            // gps location
            if (gps_lat && gps_lon) {
                data.gps_location = {
                    type: 'Point',
                    coordinates: [gps_lon, gps_lat]
                };
            }
            // base station location
            if (gsm_lat && gsm_lon) {
                data.gsm_location = {
                    type: 'Point',
                    coordinates: [gsm_lon, gsm_lat]
                };
            }
            // parse gps timestamp
            if (gps_datetime) {
                try {
                    const iso_time = new Date(Number(gps_datetime) * 1000);
                    data.gps_timestamp = iso_time;
                } catch (error) {
                    data.gps_timestamp = undefined;
                }
            }
            else {
                data.gps_timestamp = undefined
            }
            // parse gsm timestamp
            if (gsm_datetime) {
                try {
                    const iso_time = new Date(Number(gsm_datetime) * 1000);
                    data.gsm_timestamp = iso_time;
                } catch (error) {
                    data.gsm_timestamp = null;
                }
            }
            // parse RTC timestamp
            if (rtc_datetime) {
                try {
                    const iso_time = new Date(Number(rtc_datetime) * 1000);
                    data.rtc_timestamp = iso_time;
                } catch (error) {
                    data.rtc_timestamp = null;
                }
            }


            if (Object.keys(data).length > 1) {
                try {
                    //check alert
                    const new_data = validateInterrupts({ data, last_entry })
                    const data_to_save = new DataModel(new_data);
                    // console.log("data to save ", data_to_save);
                    if (!data.test_data) {
                        await data_to_save.save(new_data);
                        mqtt_client.publish("scale-antitamper/data", JSON.stringify(data))
                        await checkAlert({ data: data_to_save, users })
                    }

                } catch (error) {
                    console.log("error checking alert", error);
                }

            }
            const date = new Date();
            res.status(201).send({
                success: true, cmd: "SET_TIME", timestamp: `${date.getUTCFullYear()},${date.getUTCMonth() + 1}, ${date.getUTCDate()},${date.getUTCHours()},${date.getUTCMinutes()},${date.getUTCSeconds()}`
            })
        } catch (error) {
            console.log(chalk.red("Error in device status"), error);
            res.status(500).send({ success: false })

        }
    },


}

module.exports = controller;

// check valid interrupts
function validateInterrupts({ data, last_entry }) {
    let new_data = { ...data };
    new_data.interrupt_type = "none"; // set it to none initially
    try {
        // Define priority order explicitly
        const priority_order = ["calibration switch", "enclosure", "status"];
        const availableTypes = data.interrupt_types.split(",").map(type => type.trim());

        // Check each type in priority order
        for (const priority_type of priority_order) {
            // Only process if this interrupt type is available for this device
            if (availableTypes.includes(priority_type)) {
                // Calibration switch check (highest priority)
                if (priority_type === "calibration switch" && data.calib_switch === "on") {
                    new_data.interrupt_type = "calibration switch";
                    break;
                }

                // Enclosure check (second priority)
                if (priority_type === "enclosure" && data.enclosure === "opened") {
                    new_data.interrupt_type = "enclosure";
                    break;
                }

                // Status check (lowest priority)
                if (priority_type === "status" && data.interrupt_type === "status") {
                    new_data.interrupt_type = "none";
                    break;
                }
            }
        }

        return new_data;
    } catch (error) {
        console.error("Error validating interrupts:", error);
        return new_data;
    }
}