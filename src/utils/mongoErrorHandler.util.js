/**
 * Parses MongoDB errors and returns user-friendly messages
 * @param {Error} error - The error object from MongoDB/Mongoose
 * @returns {{ status: number, message: string }} - Friendly error response
 */
function parseMongoError(error) {
  // E11000 Duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0];
    const fieldNames = {
      email: 'email address',
      name: 'name',
      device_id: 'device ID',
      serial_number: 'serial number',
      bluetooth_mac_address: 'Bluetooth MAC address',
      phone_number: 'phone number',
    };
    const friendlyField = fieldNames[field] || field;
    return {
      status: 409,
      message: `A record with this ${friendlyField} already exists`,
    };
  }

  // ValidationError
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map(e => e.message);
    return { status: 400, message: messages.join(', ') };
  }

  // CastError (invalid ObjectId)
  if (error.name === 'CastError') {
    return { status: 400, message: `Invalid ${error.path}` };
  }

  // Default fallback
  return { status: 500, message: 'An unexpected error occurred' };
}

module.exports = { parseMongoError };
