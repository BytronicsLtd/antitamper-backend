const processResponse = require("../../utils/processResponse");
const chalk = require("chalk");
const { getYear, parse, parseISO } = require("date-fns");

const ScaleAntiTamperModel = require("../../models/scale-anti-tamper.model")


const controller = {
    updateScaleStatus: async (req, res) => {
        try {
            const payload = req.body;
            console.log("scale data payload ", payload)
            let { gps_lat, gps_lon, gsm_lat, gsm_lon, gps_datetime, gsm_datetime, rtc_datetime } = payload;
            let data = {
                ...payload
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
                data.gsm_location = {
                    type: 'Point',
                    coordinates: [gsm_lon, gsm_lat]
                };
            }
            // parse gps timestamp
            if (gps_datetime?.length > 10 ) {
                const iso_time = new Date(gps_datetime);
                data.gps_timestamp = iso_time;
            }
            else {
                data.gps_timestamp = undefined
            }
            // parse gsm timestamp
            if (gsm_datetime?.length > 10) {
                // Extract parts from "25/01/22,15:40:07"
                const [datePart, time] = gsm_datetime?.split(',');
                const just_time = time.split('+')[0]
                // Split and reverse date
                const [d, m, y] = datePart.split('/').reverse();
                const adjusted_date = new Date(`20${y}-${m}-${d} ${just_time}`)
                data.gsm_timestamp = new Date(adjusted_date - 3 * 60 * 60 * 1000)
            }
            // parse RTC timestamp
            if (rtc_datetime?.length > 5) {
                const formatted_date = rtc_datetime.replace(/(\d{2})\/(\d{2})\/(\d{2}),(.*)\+\d{2}/, '20$3-$2-$1T$4');
                const date = new Date(formatted_date); // Parse the formatted date                
                const adjusted_date = new Date(date.getTime() - 3 * 60 * 60 * 1000); // Add 3 hours
                data.rtc_timestamp = adjusted_date
            }


            console.log("data to save ", data);
            await ScaleAntiTamperModel.create(data)
            res.status(201).send({ success: true, cmd: 15 })
        } catch (error) {
            console.log(chalk.red("Error in device status"), error);
            res.status(500).send({ success: false })

        }
    },
    fetchMany: async (req, res) => {
        try {
            let = {
                device_id,
                interrupt_occured,
                start_datetime,
                end_datetime,
                search_term
            } = req.query;
            // query builder
            let query = {};
            //check for device id
            if (device_id) {
                query.device_id = device_id
            }
            // query by interrupt occurrence 
            if (interrupt_occured || interrupt_occured == 0) {
                query.interrupt_occured = parseInt(interrupt_occured)
            }
            // Handle start and end datetime for gsm_timestamp and rtc_timestamp
            if (start_datetime && end_datetime) {
                query.$or = [
                    {
                        gsm_timestamp: {
                            $gte: new Date(start_datetime).toISOString(),
                            $lte: new Date(end_datetime).toISOString()
                        }
                    },
                    {
                        rtc_timestamp: {
                            $gte: new Date(start_datetime).toISOString(),
                            $lte: new Date(end_datetime).toISOString()
                        }
                    }
                ];
            } else if (start_datetime) {
                // Only start_datetime is provided
                query.$or = [
                    { gsm_timestamp: { $gte: new Date(start_datetime).toISOString() } },
                    { rtc_timestamp: { $gte: new Date(start_datetime).toISOString() } }
                ];
            } else if (end_datetime) {
                // Only end_datetime is provided
                query.$or = [
                    { gsm_timestamp: { $lte: new Date(end_datetime).toISOString() } },
                    { rtc_timestamp: { $lte: new Date(end_datetime).toISOString() } }
                ];
            }

            // ---------------------- search query  ------------------------
            if (search_term) {
                query = {
                    ...query,
                    $or: [
                        { interrupt_type: { $regex: new RegExp(search_term, "i") } },
                        { device_id: { $regex: new RegExp(search_term, "i") } },

                    ],
                };
            }
            console.log("scale status filter ", query)
            const { page, size } = req.query;
            const limit = size ? +size : 1000;
            const offset = page ? (page - 1) * limit : 0;
            const results = await ScaleAntiTamperModel.paginate(query, {
                page, limit, offset,
                select: ``,
                sort: '-createdAt',

            });
            const docs = results.docs.map(result => {
                if (result?.gsm_lat && result?.gsm_lon) {
                    result = {
                        ...result._doc,
                        gsm_map_url: `https://www.google.com/maps/place/${result.gsm_lat},${result.gsm_lon}`

                    }
                }
                if (result?.gps_lat && result?.gps_lon) {
                    result = {
                        ...result._doc,
                        gps_map_url: `https://www.google.com/maps/place/${result.gps_lat},${result.gps_lon}`

                    }
                }
                return result
            })
            results.docs = docs;
            // Add metadata for searchable parameters
            const metadata = {
                searchable_parameters: {
                    "device_id": "String",
                    "interrupt_occured": "Number [0,1]",
                    "start_datetime": "Date",
                    "end_datetime": "Date",
                    "search_term": "String"
                }
            };

            // Include metadata in the response
            processResponse({ req, res, success: true, status: 200, results, extras: { metadata } });
        } catch (error) {
            console.log(chalk.red("Error fetching scales"), error);
            processResponse({
                req, res, success: false, status: 500,
                message: {
                    en: "Error fetching scales",
                },
            });
        }
    }
}

module.exports = controller;