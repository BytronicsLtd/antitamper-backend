const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const Schema = {
    device_id: {
        type: String,
        required: true,
        unique: true,
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
// pre save hook to generate serial number
schema.pre("save", async function (next) {
    if (this.company_id) next();
    const latest_entry = await mongoose.model("Device").findOne().sort({ createdAt: -1 }).select("company_id_counter");
    let company_id_counter = latest_entry?.company_id_counter || 0

    let padded_serial = String(company_id_counter + 1).padStart(7, '0')
    this.company_id = `BWS-${new Date().getFullYear()}-${new Date().getMonth() + 1}-${Math.ceil(Math.random()*10)}${padded_serial}`;
    this.company_id_counter = company_id + 1;
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