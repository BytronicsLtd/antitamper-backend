const chalk = require("chalk");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { addMinutes, format } = require("date-fns");
const UserModel = require("../../models/user");
const ActivityModel = require("../../models/activityLog");
const ErrorModel = require("../../models/error.model");
const phoneNumberFormatter = require("../../utils/phoneNumberFormatter.util");
const passwordValidate = require("../../utils/passwordValidate.util");
const emailSender = require("../../utils/communication/email/email.util");

const controller = {
    //request password reset
    requestReset: async (req, res) => {
        try {
            //get payload from request
            const body = req.body;
            // check if user is already registered
            const query = {
                $or: [
                    { phone_number: phoneNumberFormatter(body.email_or_phone_number) },
                    { email: body.email_or_phone_number }
                ]
            }
            // if email already exists return error
            let user = await UserModel.findOne(query)
            if (!user) {
                return res.status(404).send({ success: false, message: "User with given email or phone number not found" });
            }
            //generate email confirmation code
            body.confirmation_code = crypto
                .randomBytes(3)  // 3 bytes = 6 chars in base32
                .toString('hex')
                .substring(0, 5)
                .toUpperCase();
            //generate confirmation code expiration time with datefns
            body.confirmation_code_exp_time = addMinutes(new Date(), 30);
            //send email
            emailSender({
                template: "reset-password.handlebars",
                subject: "Password reset confirmation",
                emails: [body.email],
                payload: {
                    confirmation_code_exp_time: format(
                        body.confirmation_code_exp_time,
                        "yyyy-MM-dd HH:mm a"
                    ),
                    confirmation_code: body.confirmation_code,
                },
            })
            //update user with confirmation code and exp time
            user = await UserModel.findByIdAndUpdate(
                user.id,
                { $set: body },
                { new: true }
            );
            await ActivityModel.create({
                action: "request-password-reset", // edit, create, delete actions
                user: user.id, //user id performing the action
                email: user.email, //email of the user performinng the action
                roles: user.roles, //role of the user performing the action
                timestamp: Date.now(), // time the action was performed
                model: "User", //data model affected by the action
                affected_id: user.id, //id of the item affected by the action
                deleted_data: null, // deleted data
                edited_data: null, // edited data
            })
            user = user.toJSON()
            //respond to user
            res.status(200).send({
                success: true,
                message: "Reset code has been sent to your email"
            });
        } catch (error) {
            console.log(chalk.red("Error requesting password reset "), error);
            await ErrorModel.logError(req, error);
            res.status(500).send({ success: false, message: "An error occurred while requesting password reset" });
        }
    },

    //reset password
    resetPassword: async (req, res) => {
        try {
            const body = req.body;
            const query = {
                $or: [
                    { phone_number: phoneNumberFormatter(body.email_or_phone_number) },
                    { email: body.email_or_phone_number }
                ]
            }
            let user = await UserModel.findOne(query);
            if (!user) {
                return res.status(400).send({ success: false, message: "User with provided details not found" });
            }
           
            // compare confirmation_code with user confirmation_code
            if (user.confirmation_code !== body.confirmation_code) {
                return res.status(400).send({ success: false, message: "Invalid confirmation code" });
            }
            // check if confirmation_code has expired
            if (user.confirmation_code_exp_time < new Date()) {
                return res.status(400).send({ success: false, message: "Confirmation code has expired" });
            }
            //Check if password and confirm password match and provided
            if (body.password !== body.confirm_password || !body.password || !body.confirm_password) {
                return res.status(400).send({ success: false, message: "Password and confirm password do not match" });
            }
            //check if password contains at least 8 characters, one number and one letter and symbol
            const error_messages = passwordValidate(body.password);
            if (error_messages.length) {
                return res.status(400).send({
                    success: false, message: "Password validation failed", errors: error_messages,
                });
            }
            // update user email confirmation status
            user.confirmation_code = null;
            user.confirmation_code_exp_time = null;
            //hash password
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(body.password, salt);
            user.password = hash;
            // update user with $set
            await UserModel.findOneAndUpdate(query, { $set: user }, { runValidators: true });
            //
            await ActivityModel.create({
                action: "password-reset", // edit, create, delete actions
                user: user.id, //user id performing the action
                email: user.email, //email of the user performinng the action
                roles: user.roles, //role of the user performing the action
                timestamp: Date.now(), // time the action was performed
                model: "User", //data model affected by the action
                affected_id: user.id, //id of the item affected by the action
                deleted_data: null, // deleted data
                edited_data: null, // edited data
            })
            // return success response
            res.status(200).send({ success: true, message: "Password successfully updated" });
        } catch (error) {
            console.log(chalk.red("Error resetting  password "), error);
            await ErrorModel.logError(req, error);
            res.status(500).send({ success: false, message: "An error occurred while ressetting your password" });
        }
    },
}

module.exports = controller;

