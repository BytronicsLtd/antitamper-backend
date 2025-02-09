const chalk = require('chalk');
const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const Schema = {
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  verb: { type: String },
  body: { type: String }, // Changed to String to store JSON
  query: { type: String }, // Changed to String to store JSON
  params: { type: String }, // Changed to String to store JSON
  timestamp: { type: Date, default: Date.now },
  stacktrace: { type: String } // Changed to String to store JSON
}

const schema = new mongoose.Schema(
  Schema, {
  timestamps: true
});
//
schema.statics.logError = async function (req, error) {
  try {
    console.log("----------------------------------------------------------------------------------------");

    // Safely serialize the error object
    const safeError = {
      message: error?.message || String(error),
      stack: error?.stack,
      // For Mongoose/MongoDB specific errors
      code: error?.code,
      path: error?.path,
      value: typeof error?.value === 'object' ? JSON.stringify(error.value) : error?.value,
    };

    // Create a safe object for saving
    const logData = {
      user: req?.user?.id || null,
      verb: req?.method || 'UNKNOWN',
      body: JSON.stringify(req?.body || {}),
      query: JSON.stringify(req?.query || {}),
      params: JSON.stringify(req?.params || {}),
      timestamp: Date.now(),
      stacktrace: JSON.stringify(safeError)
    };

    return await this.create(logData);

  } catch (loggingError) {
    console.log(chalk.red("Error could not save error log:", loggingError));
    console.log(chalk.yellow("Original error:", error?.message || error));
  }
};
schema.plugin(mongoosePaginate);
schema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject();
  object.id = _id;
  return object;
});

module.exports = mongoose.model('Errors', schema, 'errors')