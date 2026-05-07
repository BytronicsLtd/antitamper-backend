const processResponse = require("../../utils/processResponse");
const chalk = require("chalk");
const DataModel = require("../../models/data.model");
const RawDataModel = require("../../models/raw-data.model");
const emailSender = require("../../utils/communication/email/email.util");
const { addHours, isSameYear } = require("date-fns");
const { getVisibleFactoryIds, applyFactoryFilter } = require('../../utils/testRegionFilter.util.js');

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
        battery_threshold,
        interrupt_type,
        factory_name,
        saved_to_sd,
        has_gp_coords,
        region,
        company_id,
        scale_model,
        sd_card_available,
      } = req.query;
      // query builder
      let query = {};
      //check for gps
      if (has_gp_coords === "true") {
        query["gps_location.coordinates"] = { $not: { $size: 0 } };
      }
      // device id
      if (device_id) {
        query.device_id = device_id;
      }
      // scale model 
      if (scale_model) {
        query.scale_model = scale_model;
      }
      // region
      if (region) {
        query.region = region;
      }
      // factory name
      if (factory_name) {
        query.factory_name = factory_name;
      }
      // company id
      if (company_id) {
        query.company_id = company_id;
      }
      if (state) {
        query.state = state;
      }
      if (interrupt_type) {
        query.interrupt_type = interrupt_type;
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
      if (battery_threshold) {
        query.battery_voltage = {
          $gte: Number(battery_threshold),
        };
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
            { factory_location: { $regex: new RegExp(search_term, "i") } },
            { factory_name: { $regex: new RegExp(search_term, "i") } },
            { company_id: { $regex: new RegExp(search_term, "i") } },
            { state: { $regex: new RegExp(search_term, "i") } },
          ],
        };
      }
      query = {
        ...(await checkAccess({ query, req })),
      };
      const { page, size } = req.query;
      const limit = size ? +size : 100;
      const offset = page ? (page - 1) * limit : 0;
      const results = await DataModel.paginate(query, {
        page,
        limit,
        offset,
        select: ``,
        sort: "-createdAt",
      });
      const docs = results.docs.map((result) => {
        // Destructure result._doc and rename _id to id
        const { _id, __v, ...rest } = result._doc;
        let modifiedResult = {
          id: _id,
          ...rest,
        };
        //
        if (!isWithinCurrentYear(rest.gsm_timestamp)) {
          modifiedResult.gsm_timestamp = modifiedResult.rtc_timestamp;
        }

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
          state: "String",
          enclosure: "String",
          device_id: "String",
          start_datetime: "Date",
          end_datetime: "Date",
          search_term: "String",
          saved_to_sd: "true|false",
          sd_card_available: "true|false",
          has_gp_coords: "true|false",
        },
      };

      // Include metadata in the response
      res.status(200).send({ success: true, metadata, results });
    } catch (error) {
      console.log(chalk.red("Error fetching scales"), error);
      processResponse({
        req,
        res,
        success: false,
        status: 500,
        message: {
          en: "Error fetching scales",
        },
      });
    }
  },
  // fetch one data point
  fetchOne: async (req, res) => {
    try {
      const id = req.query.id;
      const results = await DataModel.findById(id); // Use `findById` method
      if (!results)
        return res
          .status(404)
          .send({ success: false, message: "Record not found" });
      res.status(200).send({ success: true, results });
    } catch (error) {
      console.log(chalk.red("Error fetching data details"), error);
      res.status(500).send({ success: false });
    }
  },
  // this is for fetching raw data as received from the devices
  fetchManyRaw: async (req, res) => {
    try {
      let {
        device_id,
        start_datetime,
        end_datetime,
        search_term,
        company_id,
      } = req.query;
      // query builder
      let query = {};
      // company id
      if (company_id) {
        query.company_id = company_id;
      }
      // device id
      if (device_id) {
        query.device_id = device_id;
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
            { factory_location: { $regex: new RegExp(search_term, "i") } },
            { factory_name: { $regex: new RegExp(search_term, "i") } },
          ],
        };
      }
      query = {
        ...(await checkAccess({ query, req })),
      };
      const { page, size } = req.query;
      const limit = size ? +size : 100;
      const offset = page ? (page - 1) * limit : 0;
      const results = await RawDataModel.paginate(query, {
        page,
        limit,
        offset,
        select: ``,
        sort: "-createdAt",
      });
      res.status(200).send({ success: true, results });
    } catch (error) {
      console.log(chalk.red("Error fetching raw data"), error);
      res
        .status(500)
        .send({ success: false, message: "error fetching raw data" });
    }
  },
};

module.exports = controller;
//
function isWithinCurrentYear(time) {
  const timestamp = time instanceof Date ? time : new Date(time);
  const now = new Date();

  return isSameYear(timestamp, now);
}

async function checkAccess({ query, req }) {
  const user = req.user;
  if (user.level === "factory" && user.factory) {
    query.factory = user.factory;
    return query;
  }
  const factoryIds = await getVisibleFactoryIds(user);
  return applyFactoryFilter(query, factoryIds);
}
