const { default: axios } = require("axios");
const chalk = require("chalk");

async function sendSMS({ message, phone_numbers }) {
    try {
        const payload = {
            apikey: process.env.SMS_API_KEY,
            partnerID: process.env.SMS_PARTNERID,
            message: message,
            shortcode: process.env.SMS_SHORTCODE,
            mobile: phone_numbers
        }
        const response = await axios.post(process.env.SMS_URL, payload)
        console.log("send sms response ", response.data);
        const responses = response.data.responses
        const sent = responses.filter((response) => response['response-code'] === 200)
        const failed = responses.filter((response) => response['response-code'] >= 400)
        return { success: true, sent, failed }

    } catch (error) {
        console.log(chalk.red("error sending sms"), error.response.data);
        return { success: false, error }
    }
}

module.exports = { sendSMS };