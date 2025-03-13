const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const Schema = mongoose.Schema;

const schema = new Schema({
  type: { type: String }, // sms or email
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }, //user id performing the action
  email: { type: String }, //email of the user 
  phone_number: { type: String }, //phone number of the user 
  role: { type: String }, //role of the user 
  timestamp: { type: Date }, // time alert
  device_id: { type: String },  // device id
  types: { type: String },
  status: { type: String },
  record_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Data',
  }, //user id performing the action
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
module.exports = mongoose.model('Alert', schema, "alerts");