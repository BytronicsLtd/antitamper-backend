import Factory from '../models/factory.js'; // Correctly import the Factory model

// Create a new factory
export async function createFactory(req, res) {
  try {
    const factory = new Factory(req.body);
    const savedFactory = await factory.save();
    res.status(201).json(savedFactory);
  } catch (err) {
    res.status(400).json({ message: 'Error creating factory', error: err.message });
  }
}

// Retrieve all factories
export async function getFactories(req, res) {
  try {
    const factories = await Factory.find(); 
    res.status(200).json(factories);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving factories', error: err.message });
  }
}

// Retrieve a specific factory by ID
export async function getFactoryById(req, res) {
  try {
    const factory = await Factory.findById(req.params.factoryId); // Use `findById` method
    if (!factory) return res.status(404).json({ message: 'Factory not found' });
    res.status(200).json(factory);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving factory', error: err.message });
  }
}

// Update factory details
export async function updateFactory(req, res) {
  try {
    const updatedFactory = await Factory.findByIdAndUpdate(
      req.params.factoryId,
      req.body,
      { new: true } // Return the updated document
    );
    if (!updatedFactory) return res.status(404).json({ message: 'Factory not found' });
    res.status(200).json(updatedFactory);
  } catch (err) {
    res.status(500).json({ message: 'Error updating factory', error: err.message });
  }
}

// Deactivate a factory
export async function deactivateFactory(req, res) {
  try {
    const deactivatedFactory = await Factory.findByIdAndUpdate(
      req.params.factoryId,
      { status: 'inactive' }, // Mark as inactive
      { new: true }
    );
    if (!deactivatedFactory) return res.status(404).json({ message: 'Factory not found' });
    res.status(200).json(deactivatedFactory);
  } catch (err) {
    res.status(500).json({ message: 'Error deactivating factory', error: err.message });
  }
}
