const chalk = require("chalk");
const DataModel = require("../../models/data.model");
const { getVisibleFactoryIds, applyFactoryFilter, canActOnFactory } = require('../../utils/testRegionFilter.util.js');
const { isLevel, LEVELS } = require('../../permissions');

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
            const uid = req.user && (req.user.id || req.user._id);
            const { read } = req.query;
            if (read === 'true' && uid) query.read_by = { $in: [uid] };
            else if (read === 'false' && uid) query.read_by = { $nin: [uid] };
            const { page, size, sort } = req.query;
            const limit = size ? +size : 100;
            const offset = page ? (page - 1) * limit : 0;
            // Whitelist sortable fields the UI can ask for; anything else
            // falls back to newest-first by createdAt.
            const SORTABLE = new Set([
                'alert_timestamp', '-alert_timestamp',
                'rtc_timestamp', '-rtc_timestamp',
                'createdAt', '-createdAt',
                'company_id', '-company_id',
            ]);
            const sortSpec = sort && SORTABLE.has(sort) ? sort : '-createdAt';
            const results = await DataModel.paginate(query, {
                page, limit, offset,
                select: ``,
                sort: sortSpec,
            });
            const docs = results.docs.map(result => {
                // Destructure result._doc and rename _id to id
                const { _id, __v, read_by = [], ...rest } = result._doc;
                let modifiedResult = {
                    id: _id,
                    ...rest,
                    isRead: uid ? read_by.map(String).includes(String(uid)) : false,
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

  // Per-user read tracking — kept here so the data-alerts surface owns
  // its own read state (separate from system /alerts).
  markRead: async (req, res) => {
    try {
      const uid = req.user && (req.user.id || req.user._id);
      if (!uid) return res.status(401).send({ success: false, message: 'Unauthorised' });
      const id = req.params.id || req.query.id;
      const alert = await DataModel.findById(id).select('factory').lean();
      if (!alert) return res.status(404).send({ success: false, message: 'Alert not found' });
      if (!(await canActOnFactory(req.user, alert.factory))) {
        return res.status(403).send({ success: false, message: 'You cannot act on this alert' });
      }
      await DataModel.updateOne({ _id: id }, { $addToSet: { read_by: uid } });
      res.status(200).send({ success: true });
    } catch (e) {
      res.status(500).send({ success: false, message: 'Error marking alert read', error: e.message });
    }
  },

  markManyRead: async (req, res) => {
    try {
      const uid = req.user && (req.user.id || req.user._id);
      if (!uid) return res.status(401).send({ success: false, message: 'Unauthorised' });
      const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids : [];
      if (!ids.length) return res.status(200).send({ success: true, modified: 0 });
      // Restrict to alerts in factories the user can see — prevents
      // enumerating ids and toggling read state on alerts outside scope.
      const visibleFactoryIds = await getVisibleFactoryIds(req.user);
      const r = await DataModel.updateMany(
        {
          _id: { $in: ids },
          factory: { $in: visibleFactoryIds },
          read_by: { $nin: [uid] },
        },
        { $addToSet: { read_by: uid } },
      );
      res.status(200).send({ success: true, modified: r.modifiedCount });
    } catch (e) {
      res.status(500).send({ success: false, message: 'Error bulk marking read', error: e.message });
    }
  },

  markUnread: async (req, res) => {
    try {
      const uid = req.user && (req.user.id || req.user._id);
      if (!uid) return res.status(401).send({ success: false, message: 'Unauthorised' });
      const id = req.params.id || req.query.id;
      const alert = await DataModel.findById(id).select('factory').lean();
      if (!alert) return res.status(404).send({ success: false, message: 'Alert not found' });
      if (!(await canActOnFactory(req.user, alert.factory))) {
        return res.status(403).send({ success: false, message: 'You cannot act on this alert' });
      }
      await DataModel.updateOne({ _id: id }, { $pull: { read_by: uid } });
      res.status(200).send({ success: true });
    } catch (e) {
      res.status(500).send({ success: false, message: 'Error marking alert unread', error: e.message });
    }
  },

  unreadCount: async (req, res) => {
    try {
      const uid = req.user && (req.user.id || req.user._id);
      if (!uid) return res.status(401).send({ success: false, message: 'Unauthorised' });
      // Same alert-defining $or used by fetchMany so the count matches the list.
      const baseAlertQuery = {
        $or: [
          { interrupt_types: { $exists: true, $ne: '' } },
          { alert_types: { $ne: [] } },
        ],
      };
      // Apply the same factory-scope filter as the alerts list so the
      // badge can never show alerts the user wouldn't see in /data-alerts.
      const scoped = await checkAccess({
        query: { $and: [baseAlertQuery, { read_by: { $nin: [uid] } }] },
        req,
      });
      const count = await DataModel.countDocuments(scoped);
      res.status(200).send({ success: true, results: { count } });
    } catch (e) {
      res.status(500).send({ success: false, message: 'Error counting unread alerts', error: e.message });
    }
  },

  // Mark every alert the user can see as read for them.
  markAllRead: async (req, res) => {
    try {
      const uid = req.user && (req.user.id || req.user._id);
      if (!uid) return res.status(401).send({ success: false, message: 'Unauthorised' });
      const baseAlertQuery = {
        $or: [
          { interrupt_types: { $exists: true, $ne: '' } },
          { alert_types: { $ne: [] } },
        ],
      };
      const scoped = await checkAccess({
        query: { $and: [baseAlertQuery, { read_by: { $nin: [uid] } }] },
        req,
      });
      const r = await DataModel.updateMany(scoped, { $addToSet: { read_by: uid } });
      res.status(200).send({ success: true, modified: r.modifiedCount });
    } catch (e) {
      res.status(500).send({ success: false, message: 'Error marking all read', error: e.message });
    }
  },

  // Mark every alert the user can see as unread for them.
  markAllUnread: async (req, res) => {
    try {
      const uid = req.user && (req.user.id || req.user._id);
      if (!uid) return res.status(401).send({ success: false, message: 'Unauthorised' });
      const baseAlertQuery = {
        $or: [
          { interrupt_types: { $exists: true, $ne: '' } },
          { alert_types: { $ne: [] } },
        ],
      };
      const scoped = await checkAccess({
        query: { $and: [baseAlertQuery, { read_by: { $in: [uid] } }] },
        req,
      });
      const r = await DataModel.updateMany(scoped, { $pull: { read_by: uid } });
      res.status(200).send({ success: true, modified: r.modifiedCount });
    } catch (e) {
      res.status(500).send({ success: false, message: 'Error marking all unread', error: e.message });
    }
  },
};
module.exports = controller;

async function checkAccess({ query, req }) {
  const user = req.user;
  if (isLevel(user, LEVELS.FACTORY) && user.factory) {
    query.factory = user.factory;
    return query;
  }
  const factoryIds = await getVisibleFactoryIds(user);
  return applyFactoryFilter(query, factoryIds);
}