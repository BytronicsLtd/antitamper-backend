const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const logSchema = new Schema({
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
logSchema.index({ user: 1, action: 1, timestamp: -1 });

// Static method to log activity
logSchema.statics.logActivity = async function(userId, action, details) {
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

// Static method to get recent activity for a user
logSchema.statics.getRecentUserActivity = function(userId, limit = 10) {
  return this.find({ user: userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('user', 'name email')
    .exec();
};

module.exports = mongoose.model('ActivityLog', logSchema);