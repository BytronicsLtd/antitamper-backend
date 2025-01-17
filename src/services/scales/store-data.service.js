const isJSONUtil = require("../../utils/isJSON.util");
const { isThisYear, parse } = require("date-fns");
const chalk = require("chalk");
const ScaleAntiTamperModel = require("../../models/scale-anti-tamper.model")
module.exports = async (payload) => {
    try {
        let { gps_lat, gps_lon, gsm_lat, gsm_lon, gps_timestamp, gsm_datetime, ...others } = payload;
        let data = {
            ...others
        }
        // gps location
        if (gps_lat && gps_lon) {
            data.gps_location = {
                type: 'Point',
                coordinates: [gps_lon, gps_lat]
            };
        }
        // base station location
        if (gsm_lat && gsm_lon) {
            data.gps_location = {
                type: 'Point',
                coordinates: [gsm_lon, gsm_lat]
            };
        }
        // parse gps timestamp
        if (gps_timestamp != "null") {
            const d = gps_timestamp.split(" ")[0]
            if (!isThisYear(d)) return;
            const format_string = "yyyy-MM-dd HH:mm:ss"; // Define the format of the input string
            data.gps_timestamp = parse(gps_timestamp, format_string, new Date());
        }
        // parse gsm timestamp
        if (gsm_datetime != "null") {
            const d = gps_timestamp.split(" ")[0]
            if (!isThisYear(d)) return;
            const format_string = "yyyy-MM-dd HH:mm:ss"; // Define the format of the input string
            const parsed_datetime = parse(gps_timestamp, format_string, new Date());
            data.gsm_datetime = new Date(parsed_datetime.valueOf() - (3 * 60 * 60 * 1000))  // Subtract 3 hours for EAT to UTC

        }

        console.log("data to save ", data);

        ScaleAntiTamperModel.create(data)
        return true;
    } catch (error) {
        console.log(chalk.red("error storing transaction data "), error);

        return false
    }
}