const Alert = require("../../models/alerts.model");

const userId = (req) => req.user && (req.user.id || req.user._id);

const alertsController = {
  // Get All Alerts
  getAlerts: async (req, res) => {
    try {
      let { start_datetime, end_datetime, search_term, type, read } = req.query;
      let query = {};
      if (start_datetime && end_datetime) {
        query.createdAt = { $gte: start_datetime, $lte: end_datetime };
      }
      if (type) query.type = type;
      if (search_term) {
        query.$or = [
          { action: { $regex: new RegExp(search_term, "i") } },
          { details: { $regex: new RegExp(search_term, "i") } },
        ];
      }
      // Read/unread filter scoped to the calling user.
      const uid = userId(req);
      if (read === "true" && uid) query.read_by = { $in: [uid] };
      else if (read === "false" && uid) query.read_by = { $nin: [uid] };

      const { page, size } = req.query;
      const limit = size ? +size : 100;
      const offset = page ? (page - 1) * limit : 0;
      const results = await Alert.paginate(query, {
        page, limit, offset,
        select: ``,
        sort: '-createdAt',
      });
      // Annotate each row with isRead for the calling user. toJSON drops
      // read_by from the wire payload; isRead is what the client needs.
      const docs = (results.docs || []).map((doc) => {
        const obj = doc.toJSON ? doc.toJSON() : doc;
        const readBy = (doc.read_by || []).map(String);
        obj.isRead = uid ? readBy.includes(String(uid)) : false;
        delete obj.read_by;
        return obj;
      });
      const metadata = {
        searchable_parameters: {
          start_datetime: "Date",
          end_datetime: "Date",
          user_id: "String",
        },
      };
      res.status(200).send({ success: true, results: { ...results, docs }, metadata });
    } catch (error) {
      console.log("error fetching alerts ", error);
      res.status(500).send({ success: false, message: "Error fetching alerts", error: error.message });
    }
  },

  getDetail: async (req, res) => {
    try {
      const { id } = req.query;
      const alert = await Alert.findById(id);
      if (!alert) return res.status(404).send({ message: "Alert not found" });
      const uid = userId(req);
      const obj = alert.toJSON();
      obj.isRead = uid ? (alert.read_by || []).map(String).includes(String(uid)) : false;
      delete obj.read_by;
      res.status(200).send({ success: true, results: obj });
    } catch (error) {
      console.log("error fetching alert ", error);
      res.status(500).send({ success: false, message: "Error fetching alert", error: error.message });
    }
  },

  // Mark a single alert as read for the calling user. Idempotent.
  markRead: async (req, res) => {
    try {
      const uid = userId(req);
      if (!uid) return res.status(401).send({ success: false, message: "Unauthorised" });
      const id = req.params.id || req.query.id;
      const result = await Alert.updateOne({ _id: id }, { $addToSet: { read_by: uid } });
      if (result.matchedCount === 0) return res.status(404).send({ success: false, message: "Alert not found" });
      res.status(200).send({ success: true });
    } catch (error) {
      console.log("error marking alert read ", error);
      res.status(500).send({ success: false, message: "Error marking alert read", error: error.message });
    }
  },

  // Bulk mark-read. Body: { ids: string[] }
  markManyRead: async (req, res) => {
    try {
      const uid = userId(req);
      if (!uid) return res.status(401).send({ success: false, message: "Unauthorised" });
      const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids : [];
      if (!ids.length) return res.status(200).send({ success: true, modified: 0 });
      const result = await Alert.updateMany(
        { _id: { $in: ids }, read_by: { $nin: [uid] } },
        { $addToSet: { read_by: uid } }
      );
      res.status(200).send({ success: true, modified: result.modifiedCount });
    } catch (error) {
      console.log("error bulk marking alerts read ", error);
      res.status(500).send({ success: false, message: "Error bulk marking alerts read", error: error.message });
    }
  },

  // Mark every alert (matching the user's scope filter) as read for the
  // calling user. No body required.
  markAllRead: async (req, res) => {
    try {
      const uid = userId(req);
      if (!uid) return res.status(401).send({ success: false, message: "Unauthorised" });
      const result = await Alert.updateMany(
        { read_by: { $nin: [uid] } },
        { $addToSet: { read_by: uid } },
      );
      res.status(200).send({ success: true, modified: result.modifiedCount });
    } catch (error) {
      console.log("error mark-all-read ", error);
      res.status(500).send({ success: false, message: "Error marking all read", error: error.message });
    }
  },

  // Mark every alert as unread for the calling user.
  markAllUnread: async (req, res) => {
    try {
      const uid = userId(req);
      if (!uid) return res.status(401).send({ success: false, message: "Unauthorised" });
      const result = await Alert.updateMany(
        { read_by: { $in: [uid] } },
        { $pull: { read_by: uid } },
      );
      res.status(200).send({ success: true, modified: result.modifiedCount });
    } catch (error) {
      console.log("error mark-all-unread ", error);
      res.status(500).send({ success: false, message: "Error marking all unread", error: error.message });
    }
  },

  // Clear read state for the calling user.
  markUnread: async (req, res) => {
    try {
      const uid = userId(req);
      if (!uid) return res.status(401).send({ success: false, message: "Unauthorised" });
      const id = req.params.id || req.query.id;
      const result = await Alert.updateOne({ _id: id }, { $pull: { read_by: uid } });
      if (result.matchedCount === 0) return res.status(404).send({ success: false, message: "Alert not found" });
      res.status(200).send({ success: true });
    } catch (error) {
      console.log("error marking alert unread ", error);
      res.status(500).send({ success: false, message: "Error marking alert unread", error: error.message });
    }
  },

  // GET /alerts/unread-count — count of alerts not yet read by current user.
  unreadCount: async (req, res) => {
    try {
      const uid = userId(req);
      if (!uid) return res.status(401).send({ success: false, message: "Unauthorised" });
      const count = await Alert.countDocuments({ read_by: { $nin: [uid] } });
      res.status(200).send({ success: true, results: { count } });
    } catch (error) {
      console.log("error counting unread alerts ", error);
      res.status(500).send({ success: false, message: "Error counting unread alerts", error: error.message });
    }
  },
};

module.exports = alertsController;
