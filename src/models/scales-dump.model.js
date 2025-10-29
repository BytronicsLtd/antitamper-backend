const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const Schema = mongoose.Schema;

const schema = new Schema({
  bluetooth_mac_address: {
    type: String,
    index: true,
    default: null
  }

}, {
  timestamps: true,
  strict: false
});

schema.plugin(mongoosePaginate);
schema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject();
  object.id = _id;
  return object;
});
module.exports = mongoose.model('ScaleDump', schema, "scale-dump");