const mongoose = require('mongoose');
const validator = require('validator');
const mongoosePaginate = require('mongoose-paginate-v2');


const Schema = mongoose.Schema;

const schema = new Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function (value) {
        return validator.isEmail(value);
      },
      message: 'Please enter a valid email address'
    }
  },
  // 
  phone_number: {
    type: String,
    required: true,
    validate: [{ validator: isPhoneNumber }],
  },
  // set internally
  email_confirmed: {
    type: Boolean,
    default: false,
  },
  // set internally
  confirmation_code: {
    type: String,
    default: null,
  },
  // set internally
  confirmation_code_exp_time: {
    type: Date,
    default: null,
  },
  // jwt token  set internally
  token: {
    type: String,
    default: null,
  },
  //
  role: {
    type: String,
    enum: ['sys-admin', 'Manager', 'ICT Manager', 'FUM', 'FSC'],
    required: true
  },
  //
  level: {
    type: String,
    enum: ['factory', 'region', 'national'],
    required: function () {
      return this.role !== 'sys-admin' && this.isNew; // required for non sys admin role
    }
  },
  //user status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  factory: {
    type: Schema.Types.ObjectId,
    ref: 'Factory',
    required: function () {
      return this.role !== 'sys-admin' && this.isNew; // required for non sys admin role
    }
  },
  //region the factory belongs to
  region: {
    type: String,
    default: null,
    index: true
  },
  password: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

schema.plugin(mongoosePaginate);
schema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject();
  object.id = _id;
  return object;
});
schema.pre('save', function (next) {
  if (this.isNew) {
    // Create operation
    if (this.role !== 'sys-admin' && !this.factory) {
      next(new Error('Factory is required for non-admin users during creation'));
    }
  } else {
    // Update operation
    // Your update-specific logic here
  }
  next();
});
module.exports = mongoose.model('User', schema, 'users');

function isPhoneNumber(value) {

  const kenya_phone_regex = /^(?:254|\+254|0)?(?:(?:7(?:(?:[0-9][0-9])|(?:0[0-8])|(4[0-1]))[0-9]{6})|(?:1[0-9]{8}))$/;
  const clean_phone = value.replace(/[\s\-()]/g, '');
  if (!kenya_phone_regex.test(clean_phone)) throw new Error("Please enter a valid phone number.")
}