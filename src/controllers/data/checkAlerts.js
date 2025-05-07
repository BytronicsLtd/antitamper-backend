const chalk = require("chalk");
const emailSender = require("../../utils/communication/email/email.util");
const { sendSMS } = require("../../utils/communication/sms/sendSMS.util");
const { format, addHours } = require("date-fns");
const { formatInTimeZone } = require('date-fns-tz');

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
        const local_ke_date = formatInTimeZone(data.rtc_timestamp, 'Africa/Nairobi', 'yyyy-MM-dd HH:mm');
        console.log("send email list ", email_receivers.length)
        if (!email_receivers.length) return;
        // email_receivers = ["note5mn@gmail.com"]
        const result = await emailSender({
            template: "alert.handlebars",
            subject: "Alert!",
            emails: email_receivers,
            payload: {
                ...data._doc,
                battery_voltage: data.battery_voltage?.toFixed(2),
                timestamp: local_ke_date
            },
        })
        console.log("send email result ", result)
        //TODO
        await AlertModel.create({ type: 'email', result, reference_data: data._doc._id, email_receivers, timestamp: data.rtc_timestamp })

    }
    catch (error) {
        console.log(chalk.red("Error checking alerts"), error);
    }
}
// send sms alerts
const sendSMSAlerts = async ({ data, sms_receivers }) => {
    try {
        const local_ke_date = formatInTimeZone(data.rtc_timestamp, 'Africa/Nairobi', 'yyyy-MM-dd HH:mm');
        const alert_types = data.alert_types;
        let alert_title = ``;
        if (alert_types.includes('enclosure')) {
            alert_title += `Enclosure Tampering Detected`
        }
        if (alert_types.includes('calibration-switch')) {
            alert_title += `Calibration Switch Tampering Detected`
        }
        if (alert_types.includes('battery-voltage')) {
            alert_title += `Low battery voltage`
        }
        let message = `Alert!
${alert_title} 
Device: ${data.company_id}
Time: ${local_ke_date}
Battery: ${data.battery_voltage?.toFixed(2)} V
`
        if (!sms_receivers.length) return;

        let phone_numbers = sms_receivers.filter(user => user.phone_number).map(user => user.phone_number)
        // phone_numbers = [254705773510]
        phone_numbers = phone_numbers
        const results = await sendSMS({ phone_numbers, message })
        // console.log("send sms result ", results)
        await AlertModel.create({ type: 'sms', results, reference_data: data._doc._id, message, phone_numbers, timestamp: data.rtc_timestamp })
    }
    catch (error) {
        console.log(chalk.red("Error checking alerts"), error);
    }
}


module.exports = {
    checkAlert
}
