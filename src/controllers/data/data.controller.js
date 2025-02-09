const processResponse = require("../../utils/processResponse");
const chalk = require("chalk");
const DataModel = require("../../models/data.model")
const emailSender = require("../../utils/communication/email/email.util")


const controller = {
    // fetch many data
    fetchMany: async (req, res) => {
        try {
            let = {
                device_id,
                interrupt_occured,
                start_datetime,
                end_datetime,
                search_term,
                saved_to_sd
            } = req.query;
            // query builder
            let query = {};
            //check for device id
            if (device_id) {
                query.device_id = device_id
            }
            if (saved_to_sd) {
                query.saved_to_sd = saved_to_sd === "false" ? false : true
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
                        { factory_location: { $regex: new RegExp(search_term, "i") } },
                        { factory_name: { $regex: new RegExp(search_term, "i") } },

                    ],
                };
            }
            console.log("scale status filter ", query)
            const { page, size } = req.query;
            const limit = size ? +size : 1000;
            const offset = page ? (page - 1) * limit : 0;
            const results = await DataModel.paginate(query, {
                page, limit, offset,
                select: ``,
                sort: '-createdAt',

            });
            const docs = results.docs.map(result => {
                if (result?.gsm_lat && result?.gsm_lon) {
                    result = {
                        ...result.toJSON(),
                        gsm_map_url: `https://www.google.com/maps/place/${result.gsm_lat},${result.gsm_lon}`

                    }
                }
                if (result?.gps_lat && result?.gps_lon) {
                    result = {
                        ...result.toJSON(),
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
                    "search_term": "String",
                    "saved_to_sd": "true|false"
                }
            };

            // Include metadata in the response
            res.status(200).send({ success: true, metadata, results, });
        } catch (error) {
            console.log(chalk.red("Error fetching scales"), error);
            processResponse({
                req, res, success: false, status: 500,
                message: {
                    en: "Error fetching scales",
                },
            });
        }
    },
    //
    // fetch one data point
    fetchOne: async (req, res) => {
        try {
            const id = req.query.id
            const results = await DataModel.findById(id); // Use `findById` method
            if (!results) return res.status(404).send({ success:false, message: 'Record not found' });
            res.status(200).send({success:true, results});
        } catch (error) {
            console.log(chalk.red("Error fetching data details"), error);
            res.status(500).send({ success: false })
        }
    }
}

module.exports = controller;
