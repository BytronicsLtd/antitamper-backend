const { default: axios } = require("axios");
const chalk = require("chalk");

async function sendSMS({ message, phone_numbers }) {
    try {
        const payload = {
            senderid: process.env.SMS_USERID,
            password: process.env.SMS_PASSWORD,
            userid: process.env.SMS_USERID,
            senderid: process.env.SMS_SHORTCODE,
            msgType:'text',
            // sendMethod:'quick',
            sms: [
                {
                    mobile: phone_numbers,
                    msg: message
                },
            ]
        }
        const response = await axios.post(process.env.SMS_URL, payload)
        console.log("send sms response ", JSON.stringify(response.data));
        const {status, transactionId, requestTime, sms} = response.data;
        
        return { success: status, transactionId, requestTime, sms }

    } catch (error) {
        console.log(chalk.red("error sending sms"), error);
        return { success: false, error }
    }
}

module.exports = { sendSMS };