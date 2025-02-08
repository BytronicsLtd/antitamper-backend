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
    const factories = await Factory.find(); 
    reply.code(200).json(factories);
  } catch (err) {
    reply.code(500).json({ message: 'Error retrieving factories', error: err.message });
  }
}

// Retrieve a specific factory by ID
async function getFactoryById(req, reply) {
  try {
    const factory = await Factory.findById(req.params.factoryId); // Use `findById` method
    if (!factory) return reply.code(404).json({ message: 'Factory not found' });
    reply.code(200).json(factory);
  } catch (err) {
    reply.code(500).send({ message: 'Error retrieving factory', error: err.message });
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
    if (!updatedFactory) return reply.code(404).json({ message: 'Factory not found' });
    reply.code(200).json(updatedFactory);
  } catch (err) {
    reply.code(500).json({ message: 'Error updating factory', error: err.message });
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
    if (!deactivatedFactory) return reply.code(404).json({ message: 'Factory not found' });
    reply.code(200).json(deactivatedFactory);
  } catch (err) {
    reply.code(500).json({ message: 'Error deactivating factory', error: err.message });
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