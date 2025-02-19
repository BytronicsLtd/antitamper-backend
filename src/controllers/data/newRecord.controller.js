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
            const device =  await DeviceModel.findOne({device_id:payload.device_id})
            .populate([
                {path:'factory', transform: (doc) => doc?.toJSON() || doc,}
            ])
            if(!device){
                return res.status(404).send({success:false})
            }
            //fetch users that belong to the same factory as the device
            let users =  await UserModel.find({factory:device?.factory?.id}).select("-_id email phone_number")            
            //
            let { gps_lat, gps_lon, gsm_lat, gsm_lon, gps_datetime, gsm_datetime, rtc_datetime } = payload;
            let data = {
                ...payload,
                factory: device?.factory?.id,
                factory_name:device?.factory?.name,
                factory_location:device?.factory?.location,
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
            if (gps_datetime?.length > 10) {
                const iso_time = new Date(gps_datetime);
                data.gps_timestamp = iso_time;
            }
            else {
                data.gps_timestamp = undefined
            }
            // parse gsm timestamp
            if (gsm_datetime?.length > 10) {
                // Extract parts from "25/01/22,15:40:07"
                const [datePart, time] = gsm_datetime?.split(',');
                const just_time = time.split('+')[0]
                // Split and reverse date
                const [d, m, y] = datePart.split('/').reverse();
                const adjusted_date = new Date(`20${y}-${m}-${d} ${just_time}`)
                data.gsm_timestamp = new Date(adjusted_date - 3 * 60 * 60 * 1000)
            }
            // parse RTC timestamp
            if (rtc_datetime?.length > 5) {
                try {
                    const formatted_date = rtc_datetime.replace(/(\d{2})\/(\d{2})\/(\d{2}),(.*)\+\d{2}/, '20$3-$2-$1T$4');
                    const date = new Date(formatted_date);
                    
                    // Check if date is valid before proceeding
                    if (date instanceof Date && !isNaN(date)) {
                        const adjusted_date = new Date(date.getTime() - 3 * 60 * 60 * 1000);
                        data.rtc_timestamp = adjusted_date;
                    } else {
                        console.warn('Invalid date format:', rtc_datetime);
                        // Optionally set a default or keep existing value
                        data.rtc_timestamp = null;
                    }
                } catch (error) {
                    console.warn('Error processing date:', rtc_datetime, error);
                    data.rtc_timestamp = null;
                }
            }


            // console.log("data to save ", data);
            if(Object.keys(data).length > 1){
                await DataModel.create(data);
            }
            
            await checkAlert({data, users})
            res.status(201).send({ success: true, cmd: 15 })
        } catch (error) {
            console.log(chalk.red("Error in device status"), error);
            res.status(500).send({ success: false })

        }
    },


}

module.exports = controller;
// check for alerts
async function checkAlert({data, users}) {
    try {
        if (data.interrupt_type === 'none') return;
        // "gmnolkeri@gmail.com"
        const receivers = users.map(user=>user.email)
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