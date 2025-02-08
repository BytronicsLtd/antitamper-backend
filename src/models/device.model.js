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
    phone_number: {
        type: String,
        required: true
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
        enum: [ 'unassigned', 'active', 'inactive'],
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