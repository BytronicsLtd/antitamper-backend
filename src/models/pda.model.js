const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const crypto = require('crypto');

const Schema = {
    serial_number: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
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
    factory_location: {
        type: String,
        default: null
    },
    region: {
        type: String,
        default: null,
        index: true
    },
    status: {
        type: String,
        enum: ['staging', 'approved', 'disabled'],
        default: 'staging'
    },
    api_key: {
        type: String,
        default: null,
        select: false // Don't include in queries by default
    },
    api_key_created_at: {
        type: Date,
        default: null
    },
    approved_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    approved_at: {
        type: Date,
        default: null
    },
    last_seen_at: {
        type: Date,
        default: null
    },
    // PDA device hardware info (manufacturer, model, brand, etc.)
    device_info: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    soft_deleted: {
        type: Boolean,
        default: false
    }
};

const schema = new mongoose.Schema(Schema, {
    timestamps: true,
    strict: true
});

schema.plugin(mongoosePaginate);

schema.method("toJSON", function () {
    // Use { virtuals: false } and re-do the _id → id mapping ourselves so
    // populated subdocs (e.g. `factory`) keep their own document instances
    // and we can invoke their toJSON recursively below — toObject() returns
    // plain objects and would have stripped that.
    const obj = this.toObject({ depopulate: false });
    const { __v, _id, api_key, ...object } = obj;
    object.id = _id;
    // Normalise populated subdocs so their _id is surfaced as `id` to match
    // what the rest of the API returns. PDA-side filters on the dashboard
    // expect populated.factory.id, not populated.factory._id.
    for (const key of ["factory", "approved_by"]) {
        const sub = object[key];
        if (sub && typeof sub === "object" && !Array.isArray(sub) && sub._id != null) {
            const { _id: subId, __v: subV, ...rest } = sub;
            object[key] = { id: subId, ...rest };
        }
    }
    return object;
});

// Generate API key with factory embedded
schema.methods.generateApiKey = function () {
    // Create a key that embeds factory ID for validation
    const payload = {
        pda: this._id.toString(),
        factory: this.factory ? this.factory.toString() : null,
        created: Date.now()
    };
    const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = crypto.createHmac('sha256', process.env.SECRET_KEY || 'default_secret')
        .update(payloadStr)
        .digest('hex')
        .substring(0, 16);

    return `pda_${payloadStr}.${signature}`;
};

// Static method to verify and decode API key
schema.statics.verifyApiKey = function (apiKey) {
    if (!apiKey || !apiKey.startsWith('pda_')) {
        return null;
    }

    try {
        const keyPart = apiKey.substring(4); // Remove 'pda_' prefix
        const [payloadStr, signature] = keyPart.split('.');

        if (!payloadStr || !signature) {
            return null;
        }

        // Verify signature
        const expectedSignature = crypto.createHmac('sha256', process.env.SECRET_KEY || 'default_secret')
            .update(payloadStr)
            .digest('hex')
            .substring(0, 16);

        if (signature !== expectedSignature) {
            return null;
        }

        // Decode payload
        const payload = JSON.parse(Buffer.from(payloadStr, 'base64').toString('utf8'));
        return payload;
    } catch (error) {
        return null;
    }
};

// Index for efficient lookups
schema.index({ serial_number: 1, status: 1 });
schema.index({ factory: 1, status: 1 });

module.exports = mongoose.model('PDA', schema, 'pdas');
