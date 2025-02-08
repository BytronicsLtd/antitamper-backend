const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const Schema = {
    device_id: {
        type: String,
        required: true
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
    //
    factory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Factory',
        required: function () {
            return this.status !== 'unassigned';
        }
    },
    //
    status: {
        type: String,
        enum: ['unassigned', 'active', 'inactive'],
        default: 'unassigned'
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
module.exports = mongoose.model('Device', schema, 'devices')

function isPhoneNumber(value) {
    const kenya_phone_regex = /^(?:254|\+254|0)?(?:(?:7(?:(?:[0-9][0-9])|(?:0[0-8])|(4[0-1]))[0-9]{6})|(?:1[0-9]{8}))$/;
    const clean_phone = value.replace(/[\s\-()]/g, '');
    if (!kenya_phone_regex.test(clean_phone)) throw new Error("Please enter a valid phone number.")
}