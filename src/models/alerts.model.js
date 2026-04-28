const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const Schema = mongoose.Schema;

const schema = new Schema({
  // read_by holds the user ids that have marked this alert as read.
  // Indexed so the unread-count query ($nin / $in) is cheap.
  read_by: { type: [Schema.Types.ObjectId], default: [], index: true },
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