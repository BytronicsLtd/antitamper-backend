const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const { trim } = require('validator');

const Schema = {
    device_id: {
        type: String,
        required: true,
        validate: [{ validator: isUnique('device_id') }],
    },
    // Bws....
    company_id: {
        type: String,
    },
    company_id_counter: Number,//holds the auto incremented company id number
    // could be the scale serial number
    serial_number: {
        type: String,
    },
    // could be the scale serial number
    device_sim_card_no: {
        trim:true,
        type: String,
    },
    // SIM card attached to device
    device_sim_card: {
        type: String,
    },
    // 
    phone_number: {
        type: String,
        required: true,
        validate: [{ validator: isPhoneNumber }],
    },
    // id of factory
    factory: {
        type: String,
        ref: 'Factory',
        required: function () {
            return this.status !== 'unassigned';
        },
        default: null
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
    // set internally
    region: {
        type: String,
        default: null,
        index: true
    },
    //
    status: {
        type: String,
        enum: ['unassigned', 'active', 'inactive',],
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
    soft_deleted: {
        type: Boolean,
        default: false
    }
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

// pre save hook to generate serial number with format BWS/0000001
schema.pre("save", async function (next) {
    if (this.company_id) {
        next();
        return;
    }
    const latest_entry = await mongoose.model("Device").findOne().sort({ company_id_counter: -1 }).select("company_id_counter");
    let counter = latest_entry?.company_id_counter || 0;

    // Increment counter for new device
    counter = counter + 1;

    // Format as BWS/0000001 with 7 digits padded with zeros
    this.company_id = `BWS/${String(counter).padStart(4, '0')}`;
    this.company_id_counter = counter;

    next();
});
// 
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

function isUnique(field){
    return async function (value){
        let query = {};
        query[field] = this[field];
        const result = await mongoose.model('Device').findOne(query)

        if (result){
            throw new Error("Device ID provided already exists")
        };
    }
}