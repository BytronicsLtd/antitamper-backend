const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Import models
const UserModel = require('../../src/models/user.js');
const FactoryModel = require('../../src/models/factory.js');
const DeviceModel = require('../../src/models/device.model.js');
const PDAModel = require('../../src/models/pda.model.js');

/**
 * Create a test user with JWT token
 */
async function createTestUser(overrides = {}) {
    const defaultUser = {
        name: 'Test User',
        email: `testuser_${Date.now()}@test.com`,
        password: await bcrypt.hash('password123', 10),
        role: 'sys-admin',
        level: 'SYSTEM',
        phone_number: '254700000000',
        verified: true,
        ...overrides
    };

    const user = await UserModel.create(defaultUser);

    // Generate JWT token
    const token = jwt.sign(
        { id: user._id, email: user.email, role: user.role },
        process.env.SECRET_KEY,
        { expiresIn: '1h' }
    );

    // Store token in user
    user.token = token;
    await user.save();

    return { user, token };
}

/**
 * Create a test factory
 */
async function createTestFactory(overrides = {}) {
    const mongoose = require('mongoose');
    const defaultFactory = {
        name: `Test Factory ${Date.now()}`,
        location: 'Test Location',
        region: new mongoose.Types.ObjectId(),
        status: 'active',
        ...overrides
    };

    const factory = await FactoryModel.create(defaultFactory);
    return factory;
}

/**
 * Create a test device with bluetooth MAC
 */
async function createTestDevice(factoryId, overrides = {}) {
    const defaultDevice = {
        device_id: `DEV_${Date.now()}`,
        serial_number: `SN_${Date.now()}`,
        bluetooth_mac_address: `AA:BB:CC:DD:EE:${Math.floor(Math.random() * 100).toString(16).padStart(2, '0').toUpperCase()}`,
        factory: factoryId,
        status: 'active',
        ...overrides
    };

    const device = await DeviceModel.create(defaultDevice);
    return device;
}

/**
 * Create a test PDA
 */
async function createTestPDA(factoryId, overrides = {}) {
    // Fetch factory to get name
    const factory = await FactoryModel.findById(factoryId);

    const defaultPDA = {
        serial_number: `PDA_${Date.now()}`,
        factory: factoryId,
        factory_name: factory?.name,
        factory_location: factory?.location,
        region: factory?.region,
        status: 'staging',
        ...overrides
    };

    const pda = await PDAModel.create(defaultPDA);
    return pda;
}

/**
 * Create an approved PDA with API key
 */
async function createApprovedPDA(factoryId, overrides = {}) {
    const pda = await createTestPDA(factoryId, {
        status: 'approved',
        ...overrides
    });

    const apiKey = pda.generateApiKey();
    pda.api_key = apiKey;
    pda.api_key_created_at = new Date();
    await pda.save();

    return { pda, apiKey };
}

module.exports = {
    createTestUser,
    createTestFactory,
    createTestDevice,
    createTestPDA,
    createApprovedPDA
};
