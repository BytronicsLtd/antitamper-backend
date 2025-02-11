// Import the Factory model
const Factory = require('../../models/factory.js');

// Create a new factory
async function createFactory(req, res) {
  try {
    const factory = new Factory(req.body);
    const savedFactory = await factory.save();
    res.status(201).send(savedFactory);
  } catch (err) {
    res.status(400).send({ message: 'Error creating factory', error: err.message });
  }
}

// Retrieve all factories
async function getFactories(req, res) {
  try {
    let query = {};
    const { page, size } = req.query;
    const limit = size ? +size : 100;
    const offset = page ? (page - 1) * limit : 0;
    const results = await Factory.paginate(query, {
      page, limit, offset,
      select: ``,
      sort: '-createdAt',

    });
    res.status(200).send({ success: true, results });
  } catch (err) {
    res.staus(500).send({ success: false, message: 'Error retrieving factories', error: err.message });
  }
}

// Retrieve a specific factory by ID
async function getFactoryById(req, res) {
  try {
    const id = req.query.id
    const factory = await Factory.findById(id); // Use `findById` method
    if (!factory) return res.status(404).send({ message: 'Factory not found' });
    res.status(200).send({ success: true, results: factory });
  } catch (err) {
    res.status(500).send({ success: false, message: 'Error retrieving factory', error: err.message });
  }
}

// Update factory details
async function updateFactory(req, res) {
  try {
    const updatedFactory = await Factory.findByIdAndUpdate(
      req.params.factoryId,
      req.body,
      { new: true } // Return the updated document
    );
    if (!updatedFactory) return res.status(404).send({ message: 'Factory not found' });
    res.status(200).send({ success: true, results: updatedFactory });
  } catch (err) {
    res.status(500).send({ success: false, message: 'Error updating factory', error: err.message });
  }
}

// Deactivate a factory
async function deactivateFactory(req, res) {
  try {
    const deactivatedFactory = await Factory.findByIdAndUpdate(
      req.params.factoryId,
      { code: 'inactive' }, // Mark as inactive
      { new: true }
    );
    if (!deactivatedFactory) return res.status(404).send({ message: 'Factory not found' });
    res.status(200).send({ success: true, results: deactivatedFactory });
  } catch (err) {
    res.status(500).send({ success: false, message: 'Error deactivating factory', error: err.message });
  }
}

// Export all functions
module.exports = {
  createFactory,
  getFactories,
  getFactoryById,
  updateFactory,
  deactivateFactory
};