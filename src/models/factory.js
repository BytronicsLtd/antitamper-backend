const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const mongoosePaginate = require('mongoose-paginate-v2');

const schema = new Schema({
  name: {
    type: String,
    required: true,
    validate: [{ validator: isCompoundUnique("name",'location'), message: "A factory with the given name and within the given location already exists", },
      ],
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

// compound index
// schema.index({ name: 1, location: 1 }, { unique: true });

schema.plugin(mongoosePaginate);

schema.method('toJSON', function () {
  const { __v, _id, ...object } = this.toObject();
  object.id = _id;
  return object;
});
// validate that the factory name and location is unique 
function isCompoundUnique(field, other_field) {
  return async function (value) {
      let query = {};
      query[field] = this[field];
      query[other_field] = this[other_field];
      const result = await this.constructor.findOne(query)
      if (result) return false;
      return true
  }
}
module.exports = mongoose.model('Factory', schema, "factories");