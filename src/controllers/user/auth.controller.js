const chalk = require("chalk");
const UserModel = require("../../models/user");
const jwt = require("jsonwebtoken"); // used to create, sign, and verify tokens
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { default: mongoose } = require("mongoose");
const passwordValidationUtil = require("../../utils/passwordValidate.util");
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
                    { phone_number: body.phone_number },
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
            res.status(400).send({ message: "Error creating user", error: err.message });
        }
    },
    // login user
    login: async (req, res) => {
        try {
            //get payload from request
            const body = req.body;
            const query = {
                $or: [
                    { phone_number: body.email_or_phone_number },
                    { email: body.email_or_phone_number }
                ]
            }
            // if email already exists return error
            let user = await UserModel.findOne(query).select("email phone_number password roles")
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
            const token = jwt.sign({ id: user._id }, process.env.SECRET_KEY, {
                expiresIn: 2592000, // 30 days
            });
            const { password, createdAt, updatedAt, ...user_data } = user.toJSON();
            //save web token to db
            await UserModel.findOneAndUpdate(
                { email: body.email },
                {
                    $set: {
                        token: token,
                    },
                },
            );
            res.status(200).send({ success: true, message: "Successfully logged in", results: user_data, token });

        } catch (error) {
            console.log(chalk.red("Error logging in user "), error);
            res.status(500).send({ success: false, message: "Error retrieving users", error: error.message });

        }
    }
}
module.exports = controller;