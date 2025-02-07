const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  role: { 
    type: String, 
    enum: ['Manager', 'ICT Manager', 'FUM', 'FSC'], 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'suspended'], 
    default: 'active' 
  },
  factory: { 
    type: Schema.Types.ObjectId, 
    ref: 'Factory', 
    required: true 
  },
  password: { 
    type: String, 
    required: true 
  }
}, { 
  timestamps: true 
});

// Add any methods you need
userSchema.methods.comparePassword = async function(candidatePassword) {
  // Implement your password comparison logic here
  // return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);