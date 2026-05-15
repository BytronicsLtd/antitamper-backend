const AntitamperBoardModel = require('../../models/antitamperBoard.model');
const DeviceModel = require('../../models/device.model');
const { parseMongoError } = require('../../utils/mongoErrorHandler.util');
const { default: mongoose } = require('mongoose');

const controller = {
  create: async (req, res) => {
    try {
      const { imei, serial_number, hardware_revision, firmware_version, notes } = req.body || {};
      const board = await AntitamperBoardModel.create({
        imei,
        serial_number: serial_number || null,
        hardware_revision: hardware_revision || null,
        firmware_version: firmware_version || null,
        notes: notes || null,
      });
      return res.status(201).send({ success: true, results: board });
    } catch (err) {
      const parsed = parseMongoError(err);
      return res.status(parsed.status || 500).send({
        success: false,
        message: parsed.message || 'Error creating antitamper board',
        error: err.message,
      });
    }
  },

  fetchMany: async (req, res) => {
    try {
      const { page, size, search } = req.query;
      const limit = size ? +size : 100;
      const query = { soft_deleted: false };
      if (search) {
        const re = new RegExp(search, 'i');
        query.$or = [{ imei: re }, { serial_number: re }, { notes: re }];
      }
      const results = await AntitamperBoardModel.paginate(query, {
        page,
        limit,
        sort: '-createdAt',
      });
      return res.status(200).send({ success: true, results });
    } catch (err) {
      return res.status(500).send({
        success: false,
        message: 'Error retrieving antitamper boards',
        error: err.message,
      });
    }
  },

  // Boards not currently linked to any (non-deleted) device. Used by the
  // scale form's "link board" dropdown. Pass ?include=<id> to include the
  // currently-selected board in the result even if it is assigned — that
  // way edit dialogs can preselect it.
  available: async (req, res) => {
    try {
      const { include } = req.query || {};
      const assigned = await DeviceModel.find(
        { antitamper_board: { $ne: null }, soft_deleted: { $ne: true } },
      ).distinct('antitamper_board');
      const exclude = assigned.map((id) => String(id));
      const includeId = include && mongoose.Types.ObjectId.isValid(include)
        ? new mongoose.Types.ObjectId(include)
        : null;
      const query = {
        soft_deleted: false,
        $or: [
          { _id: { $nin: exclude } },
          ...(includeId ? [{ _id: includeId }] : []),
        ],
      };
      const boards = await AntitamperBoardModel.find(query)
        .select('imei serial_number hardware_revision firmware_version')
        .sort('serial_number');
      return res.status(200).send({ success: true, results: boards });
    } catch (err) {
      return res.status(500).send({
        success: false,
        message: 'Error retrieving available boards',
        error: err.message,
      });
    }
  },

  getOne: async (req, res) => {
    try {
      const board = await AntitamperBoardModel.findById(req.params.id);
      if (!board || board.soft_deleted) {
        return res.status(404).send({ success: false, message: 'Antitamper board not found' });
      }
      return res.status(200).send({ success: true, results: board });
    } catch (err) {
      return res.status(500).send({
        success: false,
        message: 'Error retrieving antitamper board',
        error: err.message,
      });
    }
  },

  update: async (req, res) => {
    try {
      const allowed = ['serial_number', 'hardware_revision', 'firmware_version', 'notes'];
      const patch = {};
      for (const k of allowed) {
        if (k in (req.body || {})) patch[k] = req.body[k];
      }
      // IMEI is intentionally not patchable — it's the board's identity.
      const board = await AntitamperBoardModel.findByIdAndUpdate(
        req.params.id,
        patch,
        { new: true, runValidators: true },
      );
      if (!board) {
        return res.status(404).send({ success: false, message: 'Antitamper board not found' });
      }
      return res.status(200).send({ success: true, results: board });
    } catch (err) {
      const parsed = parseMongoError(err);
      return res.status(parsed.status || 500).send({
        success: false,
        message: parsed.message || 'Error updating antitamper board',
        error: err.message,
      });
    }
  },

  remove: async (req, res) => {
    try {
      const board = await AntitamperBoardModel.findByIdAndUpdate(
        req.params.id,
        { soft_deleted: true },
        { new: true },
      );
      if (!board) {
        return res.status(404).send({ success: false, message: 'Antitamper board not found' });
      }
      return res.status(200).send({ success: true, message: 'Antitamper board deleted' });
    } catch (err) {
      return res.status(500).send({
        success: false,
        message: 'Error deleting antitamper board',
        error: err.message,
      });
    }
  },
};

module.exports = controller;
