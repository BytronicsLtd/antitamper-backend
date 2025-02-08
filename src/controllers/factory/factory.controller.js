// Import the Factory model
const Factory = require('../../models/factory.js');

// Create a new factory
async function createFactory(req, reply) {
  try {
    const factory = new Factory(req.body);
    const savedFactory = await factory.save();
    reply.status(201).send(savedFactory);
  } catch (err) {
    reply.status(400).send({ message: 'Error creating factory', error: err.message });
  }
}

// Retrieve all factories
async function getFactories(req, reply) {
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
    reply.status(200).send(results);
  } catch (err) {
    reply.staus(500).send({ message: 'Error retrieving factories', error: err.message });
  }
}

// Retrieve a specific factory by ID
async function getFactoryById(req, reply) {
  try {
    const id = req.query.id
    const factory = await Factory.findById(id); // Use `findById` method
    if (!factory) return reply.status(404).send({ message: 'Factory not found' });
    reply.status(200).send(factory);
  } catch (err) {
    reply.status(500).send({ message: 'Error retrieving factory', error: err.message });
  }
}

// Update factory details
async function updateFactory(req, reply) {
  try {
    const updatedFactory = await Factory.findByIdAndUpdate(
      req.params.factoryId,
      req.body,
      { new: true } // Return the updated document
    );
    if (!updatedFactory) return reply.status(404).send({ message: 'Factory not found' });
    reply.status(200).send(updatedFactory);
  } catch (err) {
    reply.status(500).send({ message: 'Error updating factory', error: err.message });
  }
}

// Deactivate a factory
async function deactivateFactory(req, reply) {
  try {
    const deactivatedFactory = await Factory.findByIdAndUpdate(
      req.params.factoryId,
      { code: 'inactive' }, // Mark as inactive
      { new: true }
    );
    if (!deactivatedFactory) return reply.status(404).send({ message: 'Factory not found' });
    reply.status(200).send(deactivatedFactory);
  } catch (err) {
    reply.status(500).send({ message: 'Error deactivating factory', error: err.message });
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