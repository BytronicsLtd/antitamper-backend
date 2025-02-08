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
  employees: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Add index for better query performance
schema.index({ name: 1, location: 1 }, { unique: true });

// Add any methods you might need
schema.methods.getActiveEmployees = function () {
  return this.model('User').find({
    _id: { $in: this.employees },
    status: 'active'
  });
};

schema.plugin(mongoosePaginate);

schema.method('toJSON', function () {
  const { __v, _id, ...object } = this.toObject();
  object.id = _id;
  return object;
});
module.exports = mongoose.model('Factory', schema, "factories");