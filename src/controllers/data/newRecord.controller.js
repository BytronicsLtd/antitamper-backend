const chalk = require("chalk");
const DataModel = require("../../models/data.model");
const UserModel = require("../../models/user");
const DeviceModel = require("../../models/device.model");
const emailSender = require("../../utils/communication/email/email.util")


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
            let users = await UserModel.find({ factory: device?.factory?.id }).select("-_id email phone_number")
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
            if (gps_datetime?.length) {
                try {
                    const iso_time = new Date(gps_datetime);
                    data.gps_timestamp = iso_time;
                } catch (error) {
                    data.gps_timestamp = undefined;
                }
            }
            else {
                data.gps_timestamp = undefined
            }
            // parse gsm timestamp
            if (gsm_datetime?.length) {
                try {
                    const iso_time = new Date(gsm_datetime);
                    data.gsm_timestamp = iso_time;
                } catch (error) {
                    data.gsm_timestamp = null;
                }
            }
            // parse RTC timestamp
            if (rtc_datetime?.length) {
                try {
                    const iso_time = new Date(rtc_datetime);
                    data.rtc_timestamp = iso_time;
                } catch (error) {
                    data.rtc_timestamp = null;
                }
            }

            // console.log("data to save ", data);
            if (Object.keys(data).length > 1) {
                await DataModel.create(data);
                //check alert
                try {
                    await checkAlert({ data, users })
                } catch (error) {
                    console.log("error checking alert", error);
                }
            }
            res.status(201).send({ success: true, cmd: 15 })
        } catch (error) {
            console.log(chalk.red("Error in device status"), error);
            res.status(500).send({ success: false })

        }
    },


}

module.exports = controller;
// check for alerts
async function checkAlert({ data, users }) {
    try {
        if (data.interrupt_type === 'none') return;
        // "gmnolkeri@gmail.com"
        // const receivers = users.map(user => user.email)
        const receivers = ["note5mn@gmail.com"]
        console.log("email receivers ", receivers)
        const result = await emailSender({
            template: "alert.handlebars",
            subject: "Alert!",
            emails: receivers,
            payload: data,
        })
        console.log("send email result ", result)
    }
    catch (error) {
        console.log(chalk.red("Error checking alerts"), error);
    }
}