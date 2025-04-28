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
    enum: ['sys-admin', 'admin', 'Manager', 'ICT Manager', 'FUM', 'FSC'],
    required: true
  },
  //
  level: {
    type: String,
    enum: ['factory', 'region', 'national', 'global'],
    required: true,
    validate: [{ validator: validateLevel('level') },
    ],
  },
  //user status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  soft_deleted: {
    type: Boolean,
    default: false
  },
  // check if user can receive email alerts
  can_receive_email_alerts: {
    type: Boolean,
    default: false
  },
  // check if user can receive sms alerts
  can_receive_sms_alerts: {
    type: Boolean,
    default: false
  },
  factory: {
    type: String,
    ref: 'Factory',
    validate: [{ validator: factoryRequired('factory') }],
  },
  //region the factory belongs to
  region: {
    type: String,
    default: null,
    validate: [{ validator: regionRequired('region') }],
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
//pre save
schema.pre('validate', async function (next) {
  if (this.factory === "") {
    this.factory = null
  }
  next();
});
module.exports = mongoose.model('User', schema, 'users');

function isPhoneNumber(value) {
  const kenya_phone_regex = /^(?:254|\+254|0)?(?:(?:7(?:(?:[0-9][0-9])|(?:0[0-8])|(4[0-1]))[0-9]{6})|(?:1[0-9]{8}))$/;
  const clean_phone = value.replace(/[\s\-()]/g, '');
  if (!kenya_phone_regex.test(clean_phone)) throw new Error("Please enter a valid phone number.")
}

// ensure sys-admin have a level of global
function validateLevel(field) {
  return async function (value) {
    if (this.role === 'sys-admin' && value != 'global') {
      throw new Error("System administrators must have a global level");
    }
    if (this.role !== 'sys-admin' && value === 'global') {
      throw new Error("Only system administrators can have a global level");
    }
    return true;
  }
}

function factoryRequired(field) {
  return async function (value) {
    const levels = ['region', 'national', 'global'];
    if (this.role !== 'sys-admin' && !this.factory && !levels.includes(this.level)) {
      throw new Error("Factory is required for non-admin users during creation");
    }

    if (this.role !== 'sys-admin' && this.factory) {
      const results = await mongoose.model('Factory').findById(this.factory)
      if (!results) {
        throw new Error("Provided factory does not exist");
      }
      this.region = results.region;
    }

    return true
  }
}
function regionRequired(field) {
  return async function (value) {
    const levels = ['national', 'global'];
    if (this.level === 'region' && !this.region) {
      throw new Error("Region is required");
    }
    if (levels.includes(this.level) && this.region) {
        throw new Error("Global and national users do not require a region");
    }
    return true
  }
}