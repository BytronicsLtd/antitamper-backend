const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const Schema = {
    // SIM800C IMEI — 15 digits. Once firmware starts reporting, this is
    // the key used to recognise a board on first contact.
    imei: {
        type: String,
        required: true,
        unique: true,
        validate: {
            validator: (v) => /^\d{15}$/.test(v),
            message: 'IMEI must be exactly 15 digits',
        },
    },
    // Sticker/label printed on the physical board.
    serial_number: { type: String, default: null },
    // e.g. "v1.2" — useful when a hardware rev needs a field-wide recall.
    hardware_revision: { type: String, default: null },
    // Last reported by firmware; manually settable at registration.
    firmware_version: { type: String, default: null },
    notes: { type: String, default: null },
    // First/last contact from firmware. Both null until a board phones home.
    first_seen_at: { type: Date, default: null },
    last_seen_at: { type: Date, default: null },
    soft_deleted: { type: Boolean, default: false },
};

const schema = new mongoose.Schema(Schema, { timestamps: true, strict: true });
schema.plugin(mongoosePaginate);
schema.method('toJSON', function () {
    const { __v, _id, ...object } = this.toObject();
    object.id = _id;
    return object;
});

module.exports = mongoose.model('AntitamperBoard', schema, 'antitamper_boards');
