const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

// Set up environment variables for testing
process.env.SECRET_KEY = 'test_secret_key_for_jwt';
process.env.AES_KEY = '123456789ABCDEF01122334455667788';
process.env.DEV = 'true';

beforeAll(async () => {
    // Create an in-memory MongoDB replica set
    mongoServer = await MongoMemoryReplSet.create({
        replSet: { count: 1, storageEngine: 'wiredTiger' }
    });

    const uri = mongoServer.getUri();

    // Connect mongoose to in-memory DB
    await mongoose.connect(uri, {
        dbName: 'test_db'
    });
});

afterAll(async () => {
    // Clean up
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    if (mongoServer) {
        await mongoServer.stop();
    }
});

afterEach(async () => {
    // Clear all collections after each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
});
