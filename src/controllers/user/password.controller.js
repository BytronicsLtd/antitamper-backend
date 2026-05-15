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
                emails: [user.email],
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
                action: "request-password-reset",
                user: user.id,
                email: user.email,
                role: user.role,
                timestamp: Date.now(),
                model: "User",
                affected_id: user.id,
                deleted_data: null,
                edited_data: null,
            })
            user = user.toJSON()
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

            if (user.confirmation_code !== body.confirmation_code) {
                return res.status(400).send({ success: false, message: "Invalid confirmation code" });
            }
            if (user.confirmation_code_exp_time < new Date()) {
                return res.status(400).send({ success: false, message: "Confirmation code has expired" });
            }
            if (body.password !== body.confirm_password || !body.password || !body.confirm_password) {
                return res.status(400).send({ success: false, message: "Password and confirm password do not match" });
            }
            const error_messages = passwordValidate(body.password);
            if (error_messages.length) {
                return res.status(400).send({
                    success: false, message: "Password validation failed", errors: error_messages,
                });
            }
            user.confirmation_code = null;
            user.confirmation_code_exp_time = null;
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(body.password, salt);
            user.password = hash;
            await UserModel.findOneAndUpdate(query, { $set: user }, { runValidators: false });

            await ActivityModel.create({
                action: "password-reset",
                user: user.id,
                email: user.email,
                role: user.role,
                timestamp: Date.now(),
                model: "User",
                affected_id: user.id,
                deleted_data: null,
                edited_data: null,
            })
            res.status(200).send({ success: true, message: "Password successfully updated" });
        } catch (error) {
            console.log(chalk.red("Error resetting  password "), error);
            await ErrorModel.logError(req, error);
            res.status(500).send({ success: false, message: "An error occurred while ressetting your password" });
        }
    },

    // Change password while signed in. Requires the user's current password,
    // a new password (validated with the same rules as reset-password), and a
    // matching confirmation. Refuses to run inside an impersonation session
    // so an admin cannot quietly hijack a user's credentials.
    changePassword: async (req, res) => {
        try {
            if (req.user?.isImpersonation) {
                return res.status(403).send({
                    success: false,
                    message: "Cannot change password while impersonating another user",
                });
            }

            const { current_password, new_password, confirm_password } = req.body || {};

            if (!current_password || !new_password || !confirm_password) {
                return res.status(400).send({
                    success: false,
                    message: "current_password, new_password and confirm_password are required",
                });
            }

            if (new_password !== confirm_password) {
                return res.status(400).send({
                    success: false,
                    message: "New password and confirm password do not match",
                });
            }

            const user = await UserModel.findById(req.user.id);
            if (!user || !user.password) {
                return res.status(404).send({ success: false, message: "User not found" });
            }

            const currentValid = await bcrypt.compare(current_password, user.password);
            if (!currentValid) {
                return res.status(400).send({
                    success: false,
                    message: "Current password is incorrect",
                });
            }

            // Block trivial no-op changes — also avoids a confusing "success"
            // when the user typed the same password twice.
            const sameAsCurrent = await bcrypt.compare(new_password, user.password);
            if (sameAsCurrent) {
                return res.status(400).send({
                    success: false,
                    message: "New password must be different from the current password",
                });
            }

            const error_messages = passwordValidate(new_password);
            if (error_messages.length) {
                return res.status(400).send({
                    success: false,
                    message: "Password validation failed",
                    errors: error_messages,
                });
            }

            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(new_password, salt);
            // Clear any pending reset code so an old emailed code can't be
            // reused after a successful in-app change.
            user.confirmation_code = null;
            user.confirmation_code_exp_time = null;
            await user.save();

            await ActivityModel.create({
                action: "change-password",
                user: user.id,
                email: user.email,
                role: user.role,
                timestamp: Date.now(),
                model: "User",
                affected_id: user.id,
                deleted_data: null,
                edited_data: null,
            });

            return res.status(200).send({
                success: true,
                message: "Password successfully updated",
            });
        } catch (error) {
            console.log(chalk.red("Error changing password "), error);
            await ErrorModel.logError(req, error);
            return res.status(500).send({
                success: false,
                message: "An error occurred while changing your password",
            });
        }
    },
}

module.exports = controller;
