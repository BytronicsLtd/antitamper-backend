const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const Schema = {
    gps_timestamp: Date,
    //
    gsm_timestamp: Date,
    //
    rtc_timestamp: Date,
    // set internally to aid in filtering data by factory
    factory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Factory',
    },
    factory_name: {
        type:String,
        default:null
    },
    factory_location: {
        type:String,
        default:null
    },

    //
    gps_location: {
        type: {
            type: String,
            enum: ['Point'],
            // required: true
        },
        coordinates: {
            type: [Number],
            // required: true
        }
    },
    //
    gsm_location: {
        type: {
            type: String,
            enum: ['Point'],
            // required: true
        },
        coordinates: {
            type: [Number],
            // required: true
        }
    },
}

const schema = new mongoose.Schema(
    Schema, {
    timestamps: true,
    strict: false
});


schema.plugin(mongoosePaginate);
schema.method("toJSON", function () {
    const { __v, _id, ...object } = this.toObject();
    object.id = _id;
    return object;
});
module.exports = mongoose.model('Data', schema, 'data')