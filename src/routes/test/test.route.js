const chalk = require("chalk");
const authenticate = require("../../middlewares/authenticate.middleware");
const checkRole = require("../../middlewares/checkRole.middleware");
const { sendSMS } = require("../../utils/communication/sms/sendSMS.util");

module.exports = ({ app }) => {
  //
  app.get('/api/v1/test/sms/', { preHandler: [authenticate, checkRole(['sys-admin'])] }, (req, res) => {
    testSMS(req, res);
  });
};

async function testSMS(req, res) {
  try {
    const phone_numbers = ['254724517084','254721741647','254714704110', '254722528388'];
    const message = `Alert!\nCalibration Switch Tampering Detected \n \nDevice: BWS-0003\nTime: ${new Date().toLocaleDateString()}\nBattery: 3.78 V\n`
    const response = await sendSMS({ message, phone_numbers });
    console.log("received sms response ", response);
    res.status(200).send({ success: true, results: response })
  } catch (error) {
    console.log(chalk.red("Error testing sms"), error);
    res.status(500).send({ success: false, error })
  }
}