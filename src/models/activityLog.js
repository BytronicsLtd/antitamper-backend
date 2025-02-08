const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const Schema = mongoose.Schema;

const schema = new Schema({
  user: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true  // Add index for better query performance
  },
  action: { 
    type: String, 
    required: true,
    enum: [
      'login', 
      'logout',
      'create',
      'update',
      'delete',
      'view',
      'export',
      'import',
      'status_change',
      'other'
    ]
  },
  details: { 
    type: String 
  },
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true  // Add index for better query performance
  }
}, { 
  timestamps: true 
});

// Create compound index for common queries
schema.index({ user: 1, action: 1, timestamp: -1 });

// Static method to log activity
schema.statics.logActivity = async function(userId, action, details) {
  try {
    return await this.create({
      user: userId,
      action,
      details,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error logging activity:', error);
    throw error;
  }
};

schema.plugin(mongoosePaginate);
schema.method("toJSON", function () {
    const { __v, _id, ...object } = this.toObject();
    object.id = _id;
    return object;
});
module.exports = mongoose.model('ActivityLog', schema);