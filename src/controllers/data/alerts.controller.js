const chalk = require("chalk");
const DataModel = require("../../models/data.model");
const { getVisibleRegions, applyRegionFilter } = require('../../utils/testRegionFilter.util.js');

const controller = {
  // fetch many data
  fetchMany: async (req, res) => {
    try {
      let {
        device_id,
        start_datetime,
        end_datetime,
        search_term,
        state,
        enclosure,
        interrupt_types,
        factory_name,
        saved_to_sd,
        sd_card_available,
        region,
        scale_model,
        company_id,
      } = req.query;
      // query builder
      let query = {
        $or: [
          {
            interrupt_types: {
              $exists: true,
              $ne: ""
            }
          },
          {
            alert_types: {
              $ne: []
            }
          }
        ]

      };
      // device id
      if (device_id) {
        query.device_id = device_id;
      }
      // region
      if (region) {
        query.region = region;
      }
      // factory name
      if (factory_name) {
        query.factory_name = factory_name;
      }
      // scale model 
      if (scale_model) {
        query.scale_model = scale_model;
      }
      // company id
      if (company_id) {
        query.company_id = company_id;
      }
      if (state) {
        query.state = state;
      }
      if (interrupt_types) {
        query.interrupt_types = interrupt_types;
      }
      if (enclosure) {
        query.enclosure = enclosure;
      }
      if (factory_name) {
        query.factory_name = factory_name;
      }
      if (saved_to_sd) {
        query.saved_to_sd = saved_to_sd === "false" ? false : true;
      }
       if (sd_card_available) {
        query.sd_card_available = sd_card_available === "false" ? false : true;
      }
      // Handle start and end datetime for gsm_timestamp and rtc_timestamp
      if (start_datetime && end_datetime) {
        const start = new Date(start_datetime);
        start.setHours(0, 0, 0, 0); // Start of day
        const end = new Date(end_datetime);
        end.setHours(23, 59, 59, 999); // End of day

        query.$or = [
          {
            gsm_timestamp: {
              $gte: start.toISOString(),
              $lte: end.toISOString(),
            },
          },
          {
            rtc_timestamp: {
              $gte: start.toISOString(),
              $lte: end.toISOString(),
            },
          },
        ];
      } else if (start_datetime) {
        const start = new Date(start_datetime);
        start.setHours(0, 0, 0, 0);

        query.$or = [
          { gsm_timestamp: { $gte: start.toISOString() } },
          { rtc_timestamp: { $gte: start.toISOString() } },
        ];
      } else if (end_datetime) {
        const end = new Date(end_datetime);
        end.setHours(23, 59, 59, 999);

        query.$or = [
          { gsm_timestamp: { $lte: end.toISOString() } },
          { rtc_timestamp: { $lte: end.toISOString() } },
        ];
      }

            // ---------------------- search query  ------------------------
            if (search_term) {
                query = {
                    ...query,
                    $or: [
                        { interrupt_type: { $regex: new RegExp(search_term, "i") } },
                        { device_id: { $regex: new RegExp(search_term, "i") } },
                        { company_id: { $regex: new RegExp(search_term, "i") } },
                        { factory_location: { $regex: new RegExp(search_term, "i") } },
                        { factory_name: { $regex: new RegExp(search_term, "i") } },

                    ],
                };
            }
            query = {
                ...(await checkAccess({ query, req })),
            }
            console.log("alerts  filter ", query)
            const { page, size } = req.query;
            const limit = size ? +size : 100;
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
          modifiedResult.gsm_map_url = `https://www.google.com/maps/place/${result.gsm_lat},${result.gsm_lon}`;
        }

        if (result?.gps_lat && result?.gps_lon) {
          modifiedResult.gps_map_url = `https://www.google.com/maps/place/${result.gps_lat},${result.gps_lon}`;
        }

        return modifiedResult;
      });
      results.docs = docs;
      // Add metadata for searchable parameters
      const metadata = {
        searchable_parameters: {
          company_id: "String",
          enclosure: "String",
          state: "String",
          start_datetime: "Date",
          end_datetime: "Date",
          search_term: "String",

        },
      };

      // Include metadata in the response
      res.status(200).send({  success: true, results, metadata });
    } catch (error) {
      console.log(chalk.red("Error fetching alerts"), error);
      res.status(500).send({
        message: {
          en: "Error fetching scales",
        },
      });
    }
  },
};
module.exports = controller;

// check access - now async to support test region filtering
async function checkAccess({ query, req }) {
  const user = req.user;
  const level = user.level;
  const factory = user.factory;
  const region = user.region;

  // filter by factory
  if (level === "factory") {
    query.factory = factory;
    return query;
  }

  // filter by region
  if (level === "region") {
    query.region = region;
    return query;
  }

  // For national/global users, filter by visible regions (excludes test regions unless enabled)
  const visibleRegions = await getVisibleRegions(user);
  query = applyRegionFilter(query, visibleRegions);

  return query;
}