const processResponse = require("../../utils/processResponse");
const chalk = require("chalk");
const ScaleAntiTamperModel = require("../../models/scale-anti-tamper.model")


const controller = {
    fetchMany: async(req,res)=>{
        try {
                let = {
                    device_id,
                    interrupt_occured
                } = req.query;
                // query builder
                let query = {};
                if (device_id) {
                    query.device_id = device_id
                }
                if (interrupt_occured || interrupt_occured == 0) {
                    query.interrupt_occured = parseInt(interrupt_occured)
                }
                console.log("interrupt occured ", query)
                const { page, size } = req.query;
                const limit = size ? +size : 1000;
                const offset = page ? (page - 1) * limit : 0;
                const results = await ScaleAntiTamperModel.paginate(query, {
                    page, limit, offset,
                    select: ``,
                    sort: '-createdAt',
    
                });
                const docs = results.docs.map(result => {
                    console.log("result doc ", result.gps_lat)
                    if (result?.gps_lat && result?.gps_lon) {
                        result = {
                            ...result._doc,
                            map_url: `https://www.google.com/maps/place/${result.gps_lat},${result.gps_lon}`
    
                        }
                    }
                    return result
                })
                results.docs = docs;
                processResponse({req,res,success: true, status: 200, results })
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

module.exports =  controller;