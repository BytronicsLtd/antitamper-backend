
const processResponse = async ({ req, res, status, success, message, results, error, errors, encrypt_response, extras }) => {
    let ENCRYPTION_ENABLED = encrypt_response
    // generate response data 
    const response_message = {}
    if (results) response_message.results = results;
    if (message) response_message.message = message;
    if (error) response_message.error = error;
    if (errors) response_message.errors = errors;
    // Include extra data in the response
    if (extras) {
        Object.assign(response_message, extras); // Merge extras into response_message
    }
    //send unecrypted data
    if (!ENCRYPTION_ENABLED) return res.status(status).send({ success, ...response_message });
    const text = JSON.stringify({ success, ...response_message });
    const base64_text = Buffer.from(text).toString('base64');
    res.status(status).send(base64_text);
}

module.exports = processResponse;