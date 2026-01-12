const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const Schema = mongoose.Schema;

const schema = new Schema({
  action: { type: String }, // edit, create, delete actions
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }, //user id performing the action
  email: { type: String }, //email of the user performinng the action
  role: { type: String}, //role of the user performing the action
  timestamp: { type: Date }, // time the action was performed
  model: { type: String }, //data model affected by the action
  affected_id: { type: String }, //id of the item affected by the action
  deleted_data: {}, // deleted data
  edited_data: {}, // edited data
  created_data: {}, // edited data
}, {
  timestamps: true,
  strict: false
});

// Create compound index for common queries
schema.index({ user: 1, action: 1, timestamp: -1 });

schema.plugin(mongoosePaginate);
schema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject();
  object.id = _id;
  return object;
});
module.exports = mongoose.model('ActivityLog', schema);