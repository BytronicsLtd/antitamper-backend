const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const factorySchema = new Schema({
  name: { 
    type: String, 
    required: true 
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
factorySchema.index({ name: 1, location: 1 }, { unique: true });

// Add any methods you might need
factorySchema.methods.getActiveEmployees = function() {
  return this.model('User').find({
    _id: { $in: this.employees },
    status: 'active'
  });
};

module.exports = mongoose.model('Factory', factorySchema);