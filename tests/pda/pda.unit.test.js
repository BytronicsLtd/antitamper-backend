/**
 * Unit tests for PDA Model and API Key functionality
 * These tests are isolated and don't require the full app to run
 */

const mongoose = require('mongoose');
const PDAModel = require('../../src/models/pda.model');
const FactoryModel = require('../../src/models/factory.js');
const DeviceModel = require('../../src/models/device.model');
const UnregisteredBTAttemptModel = require('../../src/models/unregistered-bt-attempt.model');

describe('PDA Model', () => {
    describe('Schema validation', () => {
        it('should require serial_number', async () => {
            const pda = new PDAModel({});
            let error;
            try {
                await pda.validate();
            } catch (e) {
                error = e;
            }
            expect(error).toBeDefined();
            expect(error.errors.serial_number).toBeDefined();
        });

        it('should create PDA with valid data', async () => {
            const factory = await FactoryModel.create({
                name: 'Test Factory',
                location: 'Test Location',
                region: 'Test Region',
                status: 'active'
            });

            const pda = await PDAModel.create({
                serial_number: `PDA_${Date.now()}`,
                factory: factory._id,
                factory_name: factory.name,
                status: 'staging'
            });

            expect(pda._id).toBeDefined();
            expect(pda.serial_number).toBeDefined();
            expect(pda.status).toBe('staging');
        });

        it('should enforce unique serial_number', async () => {
            const serial = `PDA_UNIQUE_${Date.now()}`;

            await PDAModel.create({
                serial_number: serial,
                status: 'staging'
            });

            let error;
            try {
                await PDAModel.create({
                    serial_number: serial,
                    status: 'staging'
                });
            } catch (e) {
                error = e;
            }
            expect(error).toBeDefined();
            expect(error.code).toBe(11000); // Duplicate key error
        });

        it('should have valid status enum', async () => {
            const pda = new PDAModel({
                serial_number: `PDA_${Date.now()}`,
                status: 'invalid_status'
            });

            let error;
            try {
                await pda.validate();
            } catch (e) {
                error = e;
            }
            expect(error).toBeDefined();
            expect(error.errors.status).toBeDefined();
        });
    });

    describe('API Key generation', () => {
        it('should generate API key with correct format', async () => {
            const factory = await FactoryModel.create({
                name: 'Key Test Factory',
                location: 'Test Location',
                region: 'Test Region'
            });

            const pda = await PDAModel.create({
                serial_number: `PDA_KEY_${Date.now()}`,
                factory: factory._id,
                status: 'staging'
            });

            const apiKey = pda.generateApiKey();

            expect(apiKey).toBeDefined();
            expect(apiKey.startsWith('pda_')).toBe(true);
            expect(apiKey.includes('.')).toBe(true);
        });

        it('should verify valid API key', async () => {
            const factory = await FactoryModel.create({
                name: 'Verify Test Factory',
                location: 'Test Location',
                region: 'Test Region'
            });

            const pda = await PDAModel.create({
                serial_number: `PDA_VERIFY_${Date.now()}`,
                factory: factory._id,
                status: 'approved'
            });

            const apiKey = pda.generateApiKey();
            const payload = PDAModel.verifyApiKey(apiKey);

            expect(payload).toBeDefined();
            expect(payload.pda).toBe(pda._id.toString());
            expect(payload.factory).toBe(factory._id.toString());
        });

        it('should reject invalid API key', () => {
            const payload = PDAModel.verifyApiKey('invalid_key');
            expect(payload).toBeNull();
        });

        it('should reject API key with wrong prefix', () => {
            const payload = PDAModel.verifyApiKey('wrong_base64.signature');
            expect(payload).toBeNull();
        });

        it('should reject tampered API key', async () => {
            const factory = await FactoryModel.create({
                name: 'Tamper Test Factory',
                location: 'Test Location',
                region: 'Test Region'
            });

            const pda = await PDAModel.create({
                serial_number: `PDA_TAMPER_${Date.now()}`,
                factory: factory._id,
                status: 'approved'
            });

            const apiKey = pda.generateApiKey();
            // Tamper with the key
            const tamperedKey = apiKey.slice(0, -5) + 'xxxxx';
            const payload = PDAModel.verifyApiKey(tamperedKey);

            expect(payload).toBeNull();
        });
    });

    describe('toJSON method', () => {
        it('should exclude api_key from JSON output', async () => {
            const pda = await PDAModel.create({
                serial_number: `PDA_JSON_${Date.now()}`,
                status: 'staging'
            });

            const json = pda.toJSON();

            expect(json.id).toBeDefined();
            expect(json._id).toBeUndefined();
            expect(json.__v).toBeUndefined();
            expect(json.api_key).toBeUndefined();
        });
    });
});

describe('Device Model', () => {
    describe('Bluetooth MAC address', () => {
        it('should store bluetooth_mac_address', async () => {
            const factory = await FactoryModel.create({
                name: 'Device Test Factory',
                location: 'Test Location',
                region: 'Test Region'
            });

            const device = await DeviceModel.create({
                device_id: `DEV_${Date.now()}`,
                bluetooth_mac_address: 'AA:BB:CC:DD:EE:FF',
                factory: factory._id,
                status: 'active'
            });

            expect(device.bluetooth_mac_address).toBe('AA:BB:CC:DD:EE:FF');
        });

        it('should find device by MAC address', async () => {
            const mac = `AA:BB:CC:DD:${Date.now().toString(16).slice(-4).toUpperCase()}`;
            const factory = await FactoryModel.create({
                name: 'Find Test Factory',
                location: 'Test Location',
                region: 'Test Region'
            });

            await DeviceModel.create({
                device_id: `DEV_FIND_${Date.now()}`,
                bluetooth_mac_address: mac,
                factory: factory._id,
                status: 'active'
            });

            const found = await DeviceModel.findOne({ bluetooth_mac_address: mac });
            expect(found).toBeDefined();
            expect(found.bluetooth_mac_address).toBe(mac);
        });
    });
});

describe('Unregistered BT Attempt Model', () => {
    it('should create unregistered BT attempt record', async () => {
        const attempt = await UnregisteredBTAttemptModel.create({
            mac_address: 'XX:XX:XX:XX:XX:01',
            pda_serial: 'PDA_TEST_001',
            attempted_at: new Date(),
            source: 'online'
        });

        expect(attempt._id).toBeDefined();
        expect(attempt.mac_address).toBe('XX:XX:XX:XX:XX:01');
        expect(attempt.source).toBe('online');
    });

    it('should allow sync source', async () => {
        const attempt = await UnregisteredBTAttemptModel.create({
            mac_address: 'XX:XX:XX:XX:XX:02',
            pda_serial: 'PDA_TEST_002',
            source: 'sync',
            synced_at: new Date()
        });

        expect(attempt.source).toBe('sync');
        expect(attempt.synced_at).toBeDefined();
    });
});

describe('Factory Model', () => {
    it('should create factory with all fields', async () => {
        const factory = await FactoryModel.create({
            name: 'Complete Factory',
            location: 'Full Location',
            region: 'Complete Region',
            status: 'active'
        });

        expect(factory._id).toBeDefined();
        expect(factory.name).toBe('Complete Factory');
        expect(factory.region).toBe('Complete Region');
    });
});
