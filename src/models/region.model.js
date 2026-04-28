const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const mongoosePaginate = require('mongoose-paginate-v2');

const schema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  isTest: {
    type: Boolean,
    default: false,
    index: true
  },
  // Optional geographic centre point of the region. Used for map views.
  coordinates: {
    lat: {
      type: Number,
      min: -90,
      max: 90,
    },
    lng: {
      type: Number,
      min: -180,
      max: 180,
    },
    _id: false,
  },
  soft_deleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

schema.plugin(mongoosePaginate);

// Case-insensitive unique index for region name
schema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

schema.method('toJSON', function () {
  const { __v, _id, ...object } = this.toObject();
  object.id = _id;
  return object;
});

module.exports = mongoose.model('Region', schema, 'regions');
