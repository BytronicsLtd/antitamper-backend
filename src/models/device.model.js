const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const Schema = {
    device_id: {
        type: String,
        required: true,
        unique: true
    },
    // could be the scale serial number
    serial_number: {
        type: String,
        required: true
    },
    // 
    // 
    phone_number: {
        type: String,
        required: true,
        validate: [{ validator: isPhoneNumber }],
    },
    // id of factory
    factory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Factory',
        required: function () {
            return this.status !== 'unassigned';
        }
    },
    // set internally
    factory_name: {
        type: String,
        default: null
    },
    // set internally
    factory_location: {
        type: String,
        default: null
    },
    //
    status: {
        type: String,
        enum: ['unassigned', 'active', 'inactive'],
        default: 'unassigned',
        validate: {
            validator: function (value) {
                // If factory is provided, status cannot be unassigned
                if (this.factory && value === 'unassigned') {
                    return false;
                }
                return true;
            },
            message: 'Status cannot be unassigned when factory is provided'
        }
    },
    //
}

const schema = new mongoose.Schema(
    Schema, {
    timestamps: true,
    strict: true
});


schema.plugin(mongoosePaginate);
schema.method("toJSON", function () {
    const { __v, _id, ...object } = this.toObject();
    object.id = _id;
    return object;
});
schema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], async function (next) {
    const update = this.getUpdate();
    const factory = update.factory || update.$set?.factory;
    const status = update.status || update.$set?.status;

    // If factory is being set and status is unassigned
    if (factory && status === 'unassigned') {
        throw new Error('Status cannot be unassigned when factory is provided');
    }

    // If status is being changed to unassigned, check if factory exists
    if (status === 'unassigned') {
        const doc = await this.model.findOne(this.getQuery());
        if (doc && doc.factory) {
            throw new Error('Status cannot be unassigned when factory is provided');
        }
    }

    next();
});
module.exports = mongoose.model('Device', schema, 'devices')

function isPhoneNumber(value) {
    const kenya_phone_regex = /^(?:254|\+254|0)?(?:(?:7(?:(?:[0-9][0-9])|(?:0[0-8])|(4[0-1]))[0-9]{6})|(?:1[0-9]{8}))$/;
    const clean_phone = value.replace(/[\s\-()]/g, '');
    if (!kenya_phone_regex.test(clean_phone)) throw new Error("Please enter a valid phone number.")
}