module.exports = function parseValidationErrors (errors){
    const formattedErrors = {};
     const error_arr =[];
    Object.keys(errors).forEach(field => {
        const error = errors[field];
        
        // Handle enum errors
        if (error.kind === 'enum') {
            const validValues = error.properties.enumValues.join(', ');
            formattedErrors[field] = `Please select one of: [${validValues}]`;

        }
        // Handle all other errors including custom validators
        else {
            formattedErrors[field] = error.message;
        }
        error_arr.push(formattedErrors)
    });
    return error_arr
    // return formattedErrors
}