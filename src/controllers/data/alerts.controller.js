const chalk = require("chalk");
const DataModel = require("../../models/data.model")

const controller = {
    // fetch many data
    fetchMany: async (req, res) => {
        try {
            let = {
                device_id,
                start_datetime,
                end_datetime,
                search_term
            } = req.query;
            // query builder
            let query = {
                interrupt_type : { $ne: "none" }
            };
            //check for device id
            if (device_id) {
                query.device_id = device_id
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
            console.log("alerts  filter ", query)
            const { page, size } = req.query;
            const limit = size ? +size : 1000;
            const offset = page ? (page - 1) * limit : 0;
            const results = await DataModel.paginate(query, {
                page, limit, offset,
                select: ``,
                sort: '-createdAt',

            });
            const docs = results.docs.map(result => {
                // Destructure result._doc and rename _id to id
                const { _id, __v, ...rest } = result._doc;
                let modifiedResult = {
                    id: _id,
                    ...rest,
                };

                if (result?.gsm_lat && result?.gsm_lon) {
                    modifiedResult.gsm_map_url = `https://www.google.com/maps/place/${result.gsm_lat},${result.gsm_lon}`
                }

                if (result?.gps_lat && result?.gps_lon) {
                    modifiedResult.gps_map_url = `https://www.google.com/maps/place/${result.gps_lat},${result.gps_lon}`
                }

                return modifiedResult;
            });
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
            res.status(200).send({success: true, results, metadata });
        } catch (error) {
            console.log(chalk.red("Error fetching alerts"), error);
            res.status(500).send({
                message: {
                    en: "Error fetching scales",
                },
            });
        }
    },
}
module.exports = controller