module.exports = function passwordValidator(password) {
    let error_message = [];
    // Minimum length of 8 characters
    if (password.length < 8) {
      error_message.push({
        en: "Password must be at least 8 characters long",
        fr: "Le mot de passe doit contenir au moins 8 caractères"
      });
  
    }
    // At least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      error_message.push({
        en: "Password must contain at least one uppercase letter",
      });
  
    }
    // At least one lowercase letter
    if (!/[a-z]/.test(password)) {
      error_message.push({
        en: "Password must contain at least one lowercase letter",
      });
  
    }
    // At least one digit
    if (!/\d/.test(password)) {
      error_message.push({
        en: "Password must contain at least one digit",
      });
  
    }
    //  At least one special character
    if (!/[^a-zA-Z0-9]/.test(password)) {
      error_message.push({
        en: "Password must contain at least one special character",
      });
    }
  
    return error_message;
  };