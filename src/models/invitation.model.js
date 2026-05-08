const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const { LEVEL_LIST, ROLE_LIST } = require('../permissions');

const Schema = mongoose.Schema;

/**
 * Invitation — pending account creation.
 *
 * The raw token is generated on create() and only ever exposed once (as
 * part of the email link). The DB stores its SHA-256 hash. To redeem,
 * the accept handler re-hashes the supplied token and looks the doc up
 * by tokenHash.
 */
const invitationSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    role: { type: String, enum: ROLE_LIST, required: true },
    level: { type: String, enum: LEVEL_LIST, required: true },
    region: {
      type: Schema.Types.ObjectId,
      ref: 'Region',
      default: null,
    },
    factory: {
      type: String,
      ref: 'Factory',
      default: null,
    },
    tokenHash: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'revoked', 'expired'],
      default: 'pending',
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    acceptedAt: { type: Date, default: null },
    acceptedUser: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

invitationSchema.plugin(mongoosePaginate);

invitationSchema.method('toJSON', function () {
  const { __v, _id, tokenHash, ...rest } = this.toObject();
  rest.id = _id;
  return rest;
});

module.exports = mongoose.model('Invitation', invitationSchema, 'invitations');
