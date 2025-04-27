module.exports = (phone_number) => {
    // return phone_number
    if(!phone_number) return 
    //format phone number 
    let number = phone_number;
    // 
    if (number.length === 9) {
        number = `0${number}`
    }
    //
    if (number.length === 10) {
        number = number.replace(/^0/, '+254');
    }
    //
    if (number.length === 12 && number.startsWith('254')) {
        number = number.replace(/^254/, '+254');
    }
    //
    return number

}