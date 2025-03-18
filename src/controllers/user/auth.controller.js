const chalk = require("chalk");
const UserModel = require("../../models/user");
const ActivityModel = require("../../models/activityLog");
const jwt = require("jsonwebtoken"); // used to create, sign, and verify tokens
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { default: mongoose } = require("mongoose");
const phoneNumberFormatter = require("../../utils/phoneNumberFormatter.util");
const passwordValidationUtil = require("../../utils/passwordValidate.util");
const emailSender = require("../../utils/communication/email/email.util");
const { addMinutes, format } = require("date-fns");


const controller = {
    // Create a new user
    createUser: async (req, res) => {
        const session = await mongoose.startSession();
        try {
            session.startTransaction();
            //get payload from request
            const body = req.body;
            // check if user is already registered
            const query = {
                $or: [
                    { phone_number: phoneNumberFormatter(body.phone_number) },
                    { email: body.email }
                ]
            }
            // if email already exists return error
            let user = await UserModel.findOne(query)
            if (user) {
                return res.status(400).send({ success: false, message: "User with given email or phone number already exists" });
            }
            //Check if password and confirm password match and provided
            if (body.password !== body.confirm_password || !body.password || !body.confirm_password) {
                return res.status(400).send({
                    success: false,
                    message: "Password and confirm password do not match"
                });
            }
            //check if password contains at least 8 characters, one number and one letter and symbol
            const error_messages = passwordValidationUtil(body.password);
            if (error_messages.length) {
                return res.status(400).send({
                    success: false, status: 400,
                    message: "Password validation failed", errors: error_messages,
                });
            }
            //hash password
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(body.password, salt);
            body.password = hash;
            //generate email confirmation code
            body.confirmation_code = crypto
                .randomBytes(3)  // 3 bytes = 6 chars in base32
                .toString('hex')
                .substring(0, 5)
                .toUpperCase();
            //generate confirmation code expiration time with datefns
            body.confirmation_code_exp_time = addMinutes(new Date(), 30);
            //create token valid for one month
            const id = new mongoose.Types.ObjectId();
            const token = jwt.sign({ id: id }, process.env.SECRET_KEY, {
                expiresIn: 2592000, // 30 days
            });
            body._id = id;
            // perform transaction
            user = new UserModel({
                ...body,
                token,
                phone_number: body.phone_number,
            })

            await user.save({ session });
            //
            await ActivityModel.create([{
                action: "create", // edit, create, delete actions
                user: req.user.id, //user id performing the action
                email: req.user.email, //email of the user performinng the action
                role: req.user.role, //role of the user performing the action
                timestamp: Date.now(), // time the action was performed
                model: "User", //data model affected by the action
                affected_id: user.id, //id of the item affected by the action
                deleted_data: null, // deleted data
                edited_data: null, // edited data
                created_data: user,// created data
            }], { session })
            await session.commitTransaction();
            session.endSession();

            res.status(200).send({
                success: true,
                results: { id: user.id, email: user.email, token, phone_number: user.phone_number },
                message: "User created successfully"
            });
        } catch (error) {
            console.log(chalk.red("Error creating  user "), error);
            await session.abortTransaction();
            session.endSession();
            res.status(400).send({ message: "Error creating user", error: error.message });
        }
    },
    // login user
    login: async (req, res) => {
        try {
            //get payload from request
            const body = req.body;
            const query = {
                $or: [
                    { phone_number: phoneNumberFormatter(body.email_or_phone_number) },
                    { email: body.email_or_phone_number }
                ],
                soft_deleted: { $ne: true }
            }
            console.log("login  ", query);

            // if email already exists return error
            let user = await UserModel.findOne(query)
                .populate([
                    { path: 'factory', select: "name location", transform: (doc) => doc?.toJSON() || doc }
                ])
            if (!user) {
                return res.status(404).send({ success: true, message: "User with given email or phone number not found", });
            }
            //check if password is correct
            const password_is_valid = await bcrypt.compare(
                body.password,
                user.password
            );
            if (!password_is_valid) {
                return res.status(400).send({ success: true, message: "Invalid password", });
            }
            //create token valid for one month
            const new_token = jwt.sign({ id: user._id }, process.env.SECRET_KEY, {
                expiresIn: 2592000, // 30 days
            });
            const { password, createdAt, token, updatedAt, ...user_data } = user.toJSON();
            //save web token to db
            await UserModel.findOneAndUpdate(
                query,
                {
                    $set: {
                        token: new_token,
                    },
                },
            );
            res.status(200).send({ success: true, message: "Successfully logged in", results: user_data, token: new_token });

        } catch (error) {
            console.log(chalk.red("Error logging in user "), error);
            res.status(500).send({ success: false, message: "Error logging in user", error: error.message });

        }
    },
    // request verification
    requestVerification: async (req, res) => {
        try {
            const body = req.body;
            const query = {
                $or: [
                    { phone_number: phoneNumberFormatter(body.email_or_phone_number) },
                    { email: body.email_or_phone_number }
                ]
            }
            const user = await UserModel.findOne(query);

            if (!user) {
                return res.status(404).send({
                    success: false, message: "User with given email or phone number not found"
                });
            }
            // Generate verification code
            const confirmation_code = crypto
                .randomBytes(3)
                .toString('hex')
                .substring(0, 5)
                .toUpperCase();

            const confirmation_code_exp_time = addMinutes(new Date(), 30);
            // Queue verification email
            await emailSender({
                template: "request-verification.handlebars",
                subject: "Account verification",
                emails: [body.email],
                payload: {
                    confirmation_code_exp_time: format(
                        confirmation_code_exp_time,
                        "yyyy-MM-dd HH:mm a"
                    ),
                    confirmation_code
                },
            });

            // Update user
            const updatedUser = await UserModel.findOneAndUpdate(
                query,
                {
                    $set: {
                        confirmation_code,
                        confirmation_code_exp_time
                    }
                },
                { new: true }
            );

            // Log history
            await ActivityModel.create({
                action: "request-account-verification",
                user: user.id,
                email: user.email,
                role: user.role,
                timestamp: Date.now(),
                model: "User",
                affected_id: user.id,
                deleted_data: null,
                edited_data: updatedUser
            });

            return res.status(200).send({
                success: true,
                // results: {
                //     id: user.id,
                //     confirmation_code,
                //     confirmation_code_exp_time
                // },
                message: "Reset code has been sent to your email"
            });

        } catch (error) {
            console.log(chalk.red("Error requesting password reset "), error);
            await ErrorModel.logError(req, error);
            return res.status(500).send({
                success: false, message: "An error occurred while requesting password reset"
            });
        }
    },
    // verify user
    verifyUser: async (req, res) => {
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
                return res.status(404).send({
                    success: false,
                    message: {
                        en: "User not found"
                    }
                });
            }

            if (user.confirmation_code !== body.confirmation_code) {
                return res.status(400).send({ success: false, message: "Invalid confirmation code" });
            }

            if (user.confirmation_code_exp_time < new Date()) {
                return res.status(400).send({ success: false, message: "Confirmation code has expired" });
            }

            await UserModel.findOneAndUpdate(query, {
                $set: {
                    email_confirmed: true,
                    confirmation_code: null,
                    confirmation_code_exp_time: null
                }
            });

            await ActivityModel.create({
                action: "user-verification",
                user: user.id,
                email: user.email,
                role: user.role,
                timestamp: Date.now(),
                model: "User",
                affected_id: user.id,
                deleted_data: null,
                edited_data: null,
            });

            return res.status(200).send({ success: true, message: "User verified successfully" });

        } catch (error) {
            console.log(chalk.red("Error verifying user "), error);
            await ErrorModel.logError(req, error);
            return res.status(500).send({ success: false, message: "An error occurred while verifying user" });
        }
    },
    //logout user
    logout: async (req, res) => {
        try {
            const user = req.user;
            await UserModel.findOneAndUpdate(
                { email: user.email },
                {
                    $set: {
                        token: null,
                    },
                }
            );

            // return success response
            res.status(200).send({
                success: true,
                message: "User logged out successfully"
            });
        } catch (error) {
            console.log(chalk.red("Error logging  out user "), error);
            await ErrorModel.logError(req, error);
            res.status(500).send({
                success: false, message: "Error, could not log out user",

            });
        }
    },
}
module.exports = controller;