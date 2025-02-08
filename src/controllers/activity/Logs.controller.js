const ActivityLog = require("../../models/activityLog"); // Assuming you have a model for ActivityLog

const activityLogController = {
  // Log Activity
  logActivity: async (req, reply) => {
    try {
      const logData = req.body; // Assuming you pass activity log data in the body
      const newLog = new ActivityLog(logData);
      await newLog.save();
      reply.status(201).send({ message: "Activity logged successfully", data: newLog });
    } catch (error) {
      reply.status(500).send({ message: "Error logging activity", error: error.message });
    }
  },

  // Get All Activity Logs
  getAllActivityLogs: async (req, reply) => {
    try {
      const logs = await ActivityLog.find();
      reply.status(200).send({ data: logs });
    } catch (error) {
      reply.status(500).send({ message: "Error fetching activity logs", error: error.message });
    }
  },

  // Get Logs by User ID
  getLogsByUserId: async (req, reply) => {
    try {
      const { userId } = req.params;
      const logs = await ActivityLog.find({ userId });
      if (!logs.length) return reply.status(404).send({ message: "No logs found for this user" });
      reply.status(200).send({ data: logs });
    } catch (error) {
      reply.status(500).send({ message: "Error fetching user activity logs", error: error.message });
    }
  },

  // Get Logs by Entity Type and ID
  getLogsByEntity: async (req, reply) => {
    try {
      const { entityType, entityId } = req.params;
      const logs = await ActivityLog.find({ entityType, entityId });
      if (!logs.length) return reply.status(404).send({ message: "No logs found for this entity" });
      reply.status(200).send({ data: logs });
    } catch (error) {
      reply.status(500).send({ message: "Error fetching activity logs for entity", error: error.message });
    }
  },

  // Get Logs by Date Range
  getLogsByDateRange: async (req, reply) => {
    try {
      const { startDate, endDate } = req.query; // Expecting 'startDate' and 'endDate' as query params
      const logs = await ActivityLog.find({
        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
      });
      if (!logs.length) return reply.status(404).send({ message: "No logs found for this date range" });
      reply.status(200).send({ data: logs });
    } catch (error) {
      reply.status(500).send({ message: "Error fetching activity logs by date range", error: error.message });
    }
  },

  // Get Activity Log by ID
  getActivityLogById: async (req, reply) => {
    try {
      const { logId } = req.params;
      const log = await ActivityLog.findById(logId);
      if (!log) return reply.status(404).send({ message: "Log not found" });
      reply.status(200).send({ data: log });
    } catch (error) {
      reply.status(500).send({ message: "Error fetching activity log", error: error.message });
    }
  },

  // Delete Old Logs (e.g., older than a certain threshold)
  deleteOldLogs: async (req, reply) => {
    try {
      const result = await ActivityLog.deleteMany({
        createdAt: { $lt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }, // Example: logs older than 1 year
      });
      reply.status(200).send({ message: `${result.deletedCount} old logs deleted successfully` });
    } catch (error) {
      reply.status(500).send({ message: "Error deleting old logs", error: error.message });
    }
  },
};

module.exports = activityLogController;
