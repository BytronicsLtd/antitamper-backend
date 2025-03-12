const emailSender = require("../../utils/communication/email/email.util")

// check for alerts
const checkAlert = async ({ data, users }) => {
    try {
        if (data.interrupt_type === 'none') return;
        let receivers = users.filter(user => user.can_receive_email_alerts)
        receivers = receivers.map(user => user.email)
        if (!receivers.length) return;
        const result = await emailSender({
            template: "alert.handlebars",
            subject: "Alert!",
            emails: receivers,
            payload: {
                ...data,
                timestamp: data.rtc_timestamp || data.gsm_timestamp || data.gps_timestamp
            },
        })
        console.log("send email result ", result)
    }
    catch (error) {
        console.log(chalk.red("Error checking alerts"), error);
    }
}


module.exports = {
    checkAlert
}