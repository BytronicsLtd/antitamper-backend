const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const Schema = {
    mac_address: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    pda_serial: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    pda: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PDA',
        default: null
    },
    factory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Factory',
        default: null
    },
    factory_name: {
        type: String,
        default: null
    },
    attempted_at: {
        type: Date,
        default: Date.now
    },
    source: {
        type: String,
        enum: ['online', 'sync'],
        default: 'online'
    },
    synced_at: {
        type: Date,
        default: null
    }
};

const schema = new mongoose.Schema(Schema, {
    timestamps: true,
    strict: true
});

schema.plugin(mongoosePaginate);

schema.method("toJSON", function () {
    const { __v, _id, ...object } = this.toObject();
    object.id = _id;
    return object;
});

// Index for reporting and analysis
schema.index({ mac_address: 1, pda_serial: 1 });
schema.index({ factory: 1, attempted_at: -1 });
schema.index({ attempted_at: -1 });

module.exports = mongoose.model('UnregisteredBTAttempt', schema, 'unregistered_bt_attempts');
