const { default: axios } = require("axios");
const chalk = require("chalk");

async function sendSMS({ message, phone_numbers }) {
    try {
        const sms_list = phone_numbers.map((phone_number)=>{
            return  {
                    "partnerID": process.env.SMS_PARTNER_ID,
                    "apikey": process.env.SMS_API_KEY,
                    "pass_type": "plain",
                    "clientsmsid": 1234,
                    "mobile": phone_number,
                    "message": message,
                    "shortcode": process.env.SMS_SHORTCODE, //
                }
        })
        const payload = {
            /*
            **** HOSTPINNACLE
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
                */
            //    Advanta
            "count": 1,
            "smslist": sms_list

        }
        const response = await axios.post(process.env.SMS_URL, payload)
        console.log("send sms response ", response.data);
        return response.data

    } catch (error) {
        console.log(chalk.red("error sending sms"), error);
        return { success: false, error }
    }
}

module.exports = { sendSMS };