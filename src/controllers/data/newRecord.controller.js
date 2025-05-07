const chalk = require("chalk");
const DataModel = require("../../models/data.model");
const UserModel = require("../../models/user");
const DeviceModel = require("../../models/device.model");
const RawDataModel = require("../../models/raw-data.model.js");

const MQTTClient = require("../../config/mqtt.conf");
const { checkAlert } = require("./checkAlerts.js");
const { isSameYear, addHours, addSeconds } = require("date-fns");

const mqtt_client = new MQTTClient({})
const controller = {
    updateScaleStatus: async (req, res) => {
        try {
            const payload = req.body;
            mqtt_client.publish("scale-antitamper/data", JSON.stringify(payload))
            // save the raw payload
            await RawDataModel.create(payload)
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
                soft_deleted:false,
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
                company_id: device?.company_id || device?.device_id,
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
            const now = new Date();
            const utcDate = new Date(Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate(),
                now.getUTCHours(),
                now.getUTCMinutes(),
                now.getUTCSeconds()
            ));
            // parse gsm timestamp
            if (gsm_datetime) {
                try {
                    const iso_time = new Date(Number(gsm_datetime) * 1000);
                    if (isWithinCurrentYear(iso_time)) {
                        data.gsm_timestamp = iso_time;
                    }
                    else {
                        if (data.saved_to_sd === false) {
                            data.gsm_timestamp = addHours(utcDate, 3)
                        }
                    }

                } catch (error) {
                    data.gsm_timestamp = null;
                }
            }
            // parse RTC timestamp
            if (rtc_datetime) {
                try {
                    const iso_time = new Date(Number(rtc_datetime) * 1000);

                    if (isWithinCurrentYear(iso_time)) {
                        data.rtc_timestamp = iso_time;
                    }
                    else {
                        if (data.saved_to_sd === false) {
                            data.rtc_timestamp = addHours(utcDate, 3)
                        }
                    }
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
                        await checkAlert({ data: data_to_save, users })
                    }

                } catch (error) {
                    console.log("error checking alert", error);
                }

            }
            const date = addSeconds(new Date(), 5);
            res.status(201).send({
                success: true, cmd: "SET_TIME",
                timestamp: [date.getUTCFullYear(), date.getUTCMonth() + 1,
                date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()]
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

    new_data.alert_types = []; // set it to [] initially
    try {
        // Define priority order explicitly
        const priority_order = ["calibration switch", "enclosure", "battery_voltage"];
        const availableTypes = data.interrupt_types.split(",").map(type => type.trim());

        // Check each type in priority order
        for (const priority_type of priority_order) {
            // Only process if this interrupt type is available for this device
            if (availableTypes.includes(priority_type)) {
                // Calibration switch check (highest priority)
                if (priority_type === "calibration switch" && data.calib_sw_interrupt_events.includes(" on ")) {
                    new_data.alert_types.push("calibration-switch");
                    // new_data.calib_switch = "on"
                }

                // Enclosure check (second priority) 
                if (priority_type === "enclosure" && data.enclosure_interrupt_events.includes(" opened ")) {
                    new_data.alert_types.push("enclosure");
                    // new_data.enclosure = "opened"
                }
                // Enclosure check (second priority) 
                if (data.battery_voltage < 3.4) {
                    new_data.alert_types.push("battery-voltage");
                }
            }
        }

        return new_data;
    } catch (error) {
        console.error("Error validating interrupts:", error);
        return new_data;
    }
}

//
function isWithinCurrentYear(time) {
    const timestamp = time instanceof Date ? time : new Date(time);
    const now = new Date();

    return isSameYear(timestamp, now);
}