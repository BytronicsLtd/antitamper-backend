const mongoose = require("mongoose");
const ActivityLog = require("../../models/activityLog");
const UserModel = require("../../models/user");
const { isLevel, LEVELS } = require("../../permissions");

// Resolves which user IDs the caller is allowed to see activity for, given
// scope=all. Returns either an array of ObjectIds (apply with $in) or null
// (no extra constraint — caller can see everyone).
async function visibleUserIdsFor(user) {
  if (!user) return [];
  // SYSTEM / NATIONAL — see everyone.
  if (isLevel(user, LEVELS.SYSTEM) || isLevel(user, LEVELS.NATIONAL)) {
    return null;
  }
  // REGIONAL — every user pinned to their region (or to a factory in it).
  if (isLevel(user, LEVELS.REGIONAL) && user.region) {
    const users = await UserModel.find({ region: user.region })
      .select("_id")
      .lean();
    return users.map((u) => u._id);
  }
  // FACTORY — every user in their factory.
  if (isLevel(user, LEVELS.FACTORY) && user.factory) {
    const users = await UserModel.find({ factory: user.factory })
      .select("_id")
      .lean();
    return users.map((u) => u._id);
  }
  // Anyone else gets just their own.
  return [user._id || user.id];
}

const activityLogController = {
  // Get activity logs scoped to the caller. ?scope=mine|all (default all).
  // ?factory=<id> further constrains to users pinned to that factory (only
  // honored when the caller's scope reaches multiple factories).
  getAllActivityLogs: async (req, res) => {
    try {
      const {
        start_datetime,
        end_datetime,
        search_term,
        scope = "all",
        factory,
        action,
      } = req.query;

      let query = {};

      // ---- scope ----------------------------------------------------------
      if (scope === "mine") {
        query.user = req.user._id || req.user.id;
      } else {
        // scope=all — filter to users the caller can see.
        const allowed = await visibleUserIdsFor(req.user);
        if (allowed !== null) {
          // Empty list = nothing visible; short-circuit with no docs.
          if (allowed.length === 0) {
            return res.status(200).send({
              success: true,
              results: { docs: [], totalDocs: 0, totalPages: 0, page: 1, limit: 0 },
            });
          }
          query.user = { $in: allowed };
        }

        // Optional further factory narrowing (sysadmin / national / regional).
        // Resolve users in that factory and intersect with the existing $in.
        if (factory && mongoose.isValidObjectId(factory)) {
          const inFactory = await UserModel.find({ factory })
            .select("_id")
            .lean();
          const ids = inFactory.map((u) => u._id);
          if (query.user && query.user.$in) {
            const allowedSet = new Set(query.user.$in.map(String));
            query.user = { $in: ids.filter((id) => allowedSet.has(String(id))) };
          } else {
            query.user = { $in: ids };
          }
          if (query.user.$in.length === 0) {
            return res.status(200).send({
              success: true,
              results: { docs: [], totalDocs: 0, totalPages: 0, page: 1, limit: 0 },
            });
          }
        }
      }

      // ---- time range -----------------------------------------------------
      if (start_datetime || end_datetime) {
        query.createdAt = {};
        if (start_datetime) query.createdAt.$gte = new Date(start_datetime);
        if (end_datetime) {
          const end = new Date(end_datetime);
          end.setHours(23, 59, 59, 999);
          query.createdAt.$lte = end;
        }
      }

      if (action) query.action = action;

      // ---- search ---------------------------------------------------------
      if (search_term) {
        const re = new RegExp(search_term, "i");
        query.$or = [
          { action: { $regex: re } },
          { email: { $regex: re } },
          { role: { $regex: re } },
          { model: { $regex: re } },
        ];
      }

      const { page, size } = req.query;
      const limit = size ? +size : 100;
      const offset = page ? (page - 1) * limit : 0;
      const results = await ActivityLog.paginate(query, {
        page,
        limit,
        offset,
        select: "",
        sort: "-createdAt",
        populate: [
          { path: "user", select: "-_id name email", transform: (doc) => doc?.toJSON() || doc },
        ],
      });
      const docs = results.docs.map((result) => {
        const { _id, __v, ...rest } = result._doc;
        rest.user = rest.user?.name || rest.email;
        return rest;
      });
      results.docs = docs;

      const metadata = {
        searchable_parameters: {
          start_datetime: "Date",
          end_datetime: "Date",
          search_term: "String",
          scope: "mine|all",
          factory: "ObjectId",
          action: "String",
        },
      };
      res.status(200).send({ success: true, results, metadata });
    } catch (error) {
      console.log("error fetching logs ", error);
      res.status(500).send({
        success: false,
        message: "Error fetching activity logs",
        error: error.message,
      });
    }
  },
  // Get Activity Log by ID
  getActivityLogById: async (req, res) => {
    try {
      const { id } = req.query;
      const log = await ActivityLog.findById(id);
      if (!log) return res.status(404).send({ message: "Log not found" });
      res.status(200).send({ success: true, results: log });
    } catch (error) {
      console.log("error fetching log by id ", error);
      res.status(500).send({ success: false, message: "Error fetching activity log", error: error.message });
    }
  },

  // Delete Old Logs (e.g., older than a certain threshold)
  deleteOldLogs: async (req, res) => {
    try {
      const result = await ActivityLog.deleteMany({
        createdAt: { $lt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }, // Example: logs older than 1 year
      });
      res.status(200).send({ success: true, message: `${result.deletedCount} old logs deleted successfully` });
    } catch (error) {
      console.log("error deleting old logs ", error);
      res.status(500).send({ success: false, message: "Error deleting old logs", error: error.message });
    }
  },
};

module.exports = activityLogController;
