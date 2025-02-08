const ActivityLog = require("../../models/activityLog"); // Assuming you have a model for ActivityLog

const activityLogController = {

  // Get All Activity Logs
  getAllActivityLogs: async (req, res) => {
    try {
      let = {
        start_datetime,
        end_datetime,
        search_term
      } = req.query;
      let query = {};
      //add time range query
      if (start_datetime && end_datetime) {
        query.createdAt = {
          $gte: start_datetime,  // greater than or equal to
          $lte: end_datetime     // less than or equal to
        }
      }
      // ---------------------- search query  ------------------------
      if (search_term) {
        query = {
          ...query,
          $or: [
            { action: { $regex: new RegExp(search_term, "i") } },
            { details: { $regex: new RegExp(search_term, "i") } },

          ],
        };
      }
      const { page, size } = req.query;
      const limit = size ? +size : 100;
      const offset = page ? (page - 1) * limit : 0;
      const results = await ActivityLog.paginate(query, {
        page, limit, offset,
        select: ``,
        sort: '-createdAt',

      });
      // Add metadata for searchable parameters
      const metadata = {
        searchable_parameters: {
          "start_datetime": "Date",
          "end_datetime": "Date",
          "user_id": "String"
        }
      };
      res.status(200).send({ success: true, results, metadata });
    } catch (error) {
      res.status(500).send({success: false, message: "Error fetching activity logs", error: error.message });
    }
  },
  // Get Activity Log by ID
  getActivityLogById: async (req, res) => {
    try {
      const { id } = req.query;
      const log = await ActivityLog.findById(id);
      if (!log) return res.status(404).send({ message: "Log not found" });
      res.status(200).send({success:true, results:log});
    } catch (error) {
      res.status(500).send({ success:false, message: "Error fetching activity log", error: error.message });
    }
  },

  // Delete Old Logs (e.g., older than a certain threshold)
  deleteOldLogs: async (req, res) => {
    try {
      const result = await ActivityLog.deleteMany({
        createdAt: { $lt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }, // Example: logs older than 1 year
      });
      res.status(200).send({ message: `${result.deletedCount} old logs deleted successfully` });
    } catch (error) {
      res.status(500).send({ message: "Error deleting old logs", error: error.message });
    }
  },
};

module.exports = activityLogController;
