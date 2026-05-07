const mongoose = require('mongoose');
const validator = require('validator');
const mongoosePaginate = require('mongoose-paginate-v2');

const {
  LEVELS,
  LEVEL_LIST,
  ROLES,
  ROLE_LIST,
  levelForRole,
} = require('../permissions');

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
    trim: true,
    lowercase: true,
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
  // designation
  designation: {
    type: String,
  },
  // jwt token  set internally
  token: {
    type: String,
    default: null,
  },
  //
  role: {
    type: String,
    enum: ROLE_LIST,
    required: true
  },
  //
  level: {
    type: String,
    enum: LEVEL_LIST,
    required: true,
    validate: [{ validator: validateLevel('level') },
    ],
  },
  // 
  factory: {
    type: String,
    ref: 'Factory',
    validate: [{ validator: factoryRequired('factory') }],
    defaul: null,
  },
  region: {
    type: Schema.Types.ObjectId,
    ref: 'Region',
    default: null,
    validate: [{ validator: regionRequired('region') }],
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
  // user settings (for sys-admin preferences)
  settings: {
    // Show test data (test regions, test factories, etc.) for debugging.
    showTestData: {
      type: Boolean,
      default: false
    }
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

module.exports = mongoose.model('User', schema, 'users');

function isPhoneNumber(value) {
  const kenya_phone_regex = /^(?:254|\+254|0)?(?:(?:7(?:(?:[0-9][0-9])|(?:0[0-8])|(4[0-1]))[0-9]{6})|(?:1[0-9]{8}))$/;
  const clean_phone = value.replace(/[\s\-()]/g, '');
  if (!kenya_phone_regex.test(clean_phone)) throw new Error("Please enter a valid phone number.")
}

// Level/role agreement: a role's home level (per the registry) must match
// the user's level. The registry is the single source of truth.
function validateLevel(field) {
  return function (value) {
    const expected = levelForRole(this.role);
    if (expected && expected !== value) {
      throw new Error(`Role ${this.role} requires level ${expected}, got ${value}`);
    }
    return true;
  }
}

// FACTORY users must point at an existing Factory; broader-scope users
// must not carry a factory ref.
function factoryRequired(field) {
  return async function (value) {
    if (this.level === LEVELS.FACTORY) {
      if (!this.factory) {
        throw new Error("Factory is required for factory-level users");
      }
      const results = await mongoose.model('Factory').findById(this.factory);
      if (!results) {
        throw new Error("Provided factory does not exist");
      }
      this.region = results.region;
    } else {
      // SYSTEM / NATIONAL / REGIONAL users have no factory binding.
      this.factory = null;
    }
    return true;
  }
}

// REGIONAL users must point at a region; FACTORY inherits region from the
// referenced factory (set in factoryRequired); SYSTEM / NATIONAL must not
// carry a region ref.
function regionRequired(field) {
  return async function (value) {
    const data = this;
    if (data.level === LEVELS.REGIONAL && !value) {
      throw new Error("Region is required for regional-level users");
    }
    if ((data.level === LEVELS.SYSTEM || data.level === LEVELS.NATIONAL) && value) {
      throw new Error("System and national users do not have a region");
    }
    return true;
  }
}