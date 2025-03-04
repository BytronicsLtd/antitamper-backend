const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const mongoosePaginate = require('mongoose-paginate-v2');

const schema = new Schema({
  name: {
    type: String,
    required: true,
    unique: false,
  },
  location: {
    type: String,
    required: true
  },
  // region the factory belongs to
  region: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  soft_deleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Add index for better query performance
schema.index({ name: 1, location: 1 }, { unique: true });

schema.plugin(mongoosePaginate);

schema.method('toJSON', function () {
  const { __v, _id, ...object } = this.toObject();
  object.id = _id;
  return object;
});
module.exports = mongoose.model('Factory', schema, "factories");