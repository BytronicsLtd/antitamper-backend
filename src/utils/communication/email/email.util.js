const handlebars = require("handlebars");
const nodemailer = require("nodemailer");
const chalk = require("chalk");
const fs = require("fs");
const path = require("path");

// email templates path
const template_path = require("./templates/index");
// add is equal helper in handlebars
handlebars.registerHelper("ifEquals", function (arg1, arg2, options) {
  return arg1 === arg2 ? options.fn(this) : options.inverse(this);
});
// add includes
handlebars.registerHelper("includes", function (array, value, options) {
  // Check if the array exists and is actually an array
  if (array && Array.isArray(array)) {
    return array.includes(value) ? options.fn(this) : options.inverse(this);
  }
  // Handle string includes case
  if (typeof array === 'string') {
    return array.includes(value) ? options.fn(this) : options.inverse(this);
  }
  // Default to false if not an array or string
  return options.inverse(this);
});

const emailSender = async ({ template, emails, subject, text, payload, attachments }) => {

  try {
    const source = fs.readFileSync(path.join(template_path, template), "utf8");
    const compiledTemplate = handlebars.compile(source);
    const transporter = nodemailer.createTransport({
      secure: false, // true for 465, false for other ports
      host: process.env.EMAIL_HOST,
      post: process.env.EMAIL_PORT,

      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD, //qzzs mozz fhjr fpcx
      },
    });
    const mailOptions = {
      to: emails,
      cc: process.env.EMAIL_USERNAME,
      from: process.env.EMAIL_USERNAME,
      subject: subject,
      text,
      html: compiledTemplate(payload),
      attachments,
    };
    const response = await transporter.sendMail(mailOptions);
    return { success: true, response };
  } catch (error) {
    console.log(chalk.red("Error sending email  "), error);
    return { success: false };
  }
};

module.exports = emailSender;


