const chalk = require("chalk");
const emailSender = require("../../utils/communication/email/email.util");
const { sendSMS } = require("../../utils/communication/sms/sendSMS.util");
const { format, addHours } = require("date-fns");
const AlertModel = require("../../models/alerts.model.js")
// check for alerts
const checkAlert = async ({ data, users }) => {
    try {
        console.log("alert type ", data);

        if (!data.alert_types.length) return;
        // get email receivers
        let email_receivers = users.filter(user => user.can_receive_email_alerts)
        email_receivers = email_receivers.map(user => user.email)
        // get sms receivers
        let sms_receivers = users.filter(user => user.can_receive_sms_alerts)
        sendEmailAlerts({ data, email_receivers }) // send email alerts
        sendSMSAlerts({ data, sms_receivers })
    }
    catch (error) {
        console.log(chalk.red("Error checking alerts"), error);
    }
}
// send email alerts
const sendEmailAlerts = async ({ data, email_receivers }) => {
    try {
        console.log("send email list ", email_receivers.length)
        if (!email_receivers.length) return;
        // email_receivers = ["note5mn@gmail.com"]
        const result = await emailSender({
            template: "alert.handlebars",
            subject: "Alert!",
            emails: email_receivers,
            payload: {
                ...data._doc,
                timestamp: getValidTimestamp(data)
            },
        })
        console.log("send email result ", result)
        //TODO
        await AlertModel.create({ type: 'email', ...result, reference_data: data._doc._id })

    }
    catch (error) {
        console.log(chalk.red("Error checking alerts"), error);
    }
}
// send sms alerts
const sendSMSAlerts = async ({ data, sms_receivers }) => {
    try {
        let message = `Alert!
${data.interrupt_type} tampering detected
Device: ${data.device_id}
Battery: ${data.battery_voltage?.toFixed(2)}V
Backup available: ${data.sd_card_available}
From backup: ${data.saved_to_sd}
Time: ${format(data.rtc_timestamp, "dd/MM/yyy HH:mm")}
`
        if (!sms_receivers.length) return;
        console.log("sms_receivers ==== ", sms_receivers);
        
        let phone_numbers = sms_receivers.map(user => user.phone_number)
        // phone_numbers = [254705773510]
        phone_numbers = phone_numbers
        const results = await sendSMS({ phone_numbers, message })
        console.log("send sms result ", results)
        await AlertModel.create({ type: 'sms', ...results, reference_data: data._doc._id })
    }
    catch (error) {
        console.log(chalk.red("Error checking alerts"), error);
    }
}


module.exports = {
    checkAlert
}
function getValidTimestamp(data) {
    // Function to validate if a timestamp is valid
    const isValidDate = (timestamp) => {
        return timestamp instanceof Date && !isNaN(timestamp.getTime());
    };
    // Function to convert UTC to Kenyan time (UTC+3)
    const convertToKenyanTime = (timestamp) => {
        if (!isValidDate(timestamp)) return null;
        return addHours(timestamp, 3);
    };
    // Check each timestamp in order of preference
    // if (data?.gsm_timestamp && isValidDate(data.gsm_timestamp)) {
    //     return data.gsm_timestamp;
    // }
    // 
    if (data?.rtc_timestamp && isValidDate(data.rtc_timestamp)) {
        // return data.rtc_timestamp;
        return convertToKenyanTime(data.rtc_timestamp);
    }
    // 
    // if (data?.gps_timestamp && isValidDate(data.gps_timestamp)) {
    //     return convertToKenyanTime(data.gps_timestamp);
    // }

    // If no valid timestamp is found, return null or a default value
    return null;
}