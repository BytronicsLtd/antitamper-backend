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
        // sendSMSAlerts({ data, sms_receivers })
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
        email_receivers = ["note5mn@gmail.com"]
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
        // for await (const email of email_receivers) {
        //     await AlertModel.create({
        //         email: email, //email of the user 
           
        //     })
        // }
    }
    catch (error) {
        console.log(chalk.red("Error checking alerts"), error);
    }
}
// send sms alerts
const sendSMSAlerts = async ({ data, sms_receivers }) => {
    try {
        let message = `Alert from device ${data.device_id}
                 Alert(s): ${data.interrupt_types} 
                 State: ${data.state}
                 Enclosure: ${data.enclosure}
                 Calibration switch: ${data.calib_switch}
                 Time: ${format(getValidTimestamp(data), "dd/MM/yyy HH:mm")}
                `

        console.log("sms receivers ", sms_receivers);
        console.log("sms message ", message);

        if (!sms_receivers.length) return;
        let phone_numbers = sms_receivers.map(user => user.phone_number)
        phone_numbers = [254724517084]
        phone_numbers = phone_numbers.join(",")
        const { success, sent, failed } = await sendSMS({ phone_numbers, message })

        console.log("send sms result ", failed)
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