const { buildApp } = require('../helpers/app');
const {
    createTestUser,
    createTestFactory,
    createTestDevice,
    createTestPDA,
    createApprovedPDA
} = require('../helpers/testData');

let app;

beforeAll(async () => {
    app = await buildApp();
    await app.ready();
});

afterAll(async () => {
    await app.close();
});

describe('PDA Registration Endpoint', () => {
    describe('POST /api/v1/pda/register', () => {
        it('should return 400 if pda_serial is missing', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/pda/register',
                payload: {
                    bluetooth_mac_address: 'AA:BB:CC:DD:EE:FF'
                }
            });

            expect(response.statusCode).toBe(400);
            expect(JSON.parse(response.payload).success).toBe(false);
        });

        it('should return 400 if bluetooth_mac_address is missing', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/pda/register',
                payload: {
                    pda_serial: 'PDA123'
                }
            });

            expect(response.statusCode).toBe(400);
            expect(JSON.parse(response.payload).success).toBe(false);
        });

        it('should return 404 and log attempt if BT device is not registered', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/pda/register',
                payload: {
                    pda_serial: 'PDA123',
                    bluetooth_mac_address: 'XX:XX:XX:XX:XX:XX'
                }
            });

            expect(response.statusCode).toBe(404);
            const body = JSON.parse(response.payload);
            expect(body.success).toBe(false);
            expect(body.status).toBe('bt_not_registered');
        });

        it('should create PDA in staging when BT device is registered', async () => {
            const factory = await createTestFactory();
            const device = await createTestDevice(factory._id);

            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/pda/register',
                payload: {
                    pda_serial: `PDA_${Date.now()}`,
                    bluetooth_mac_address: device.bluetooth_mac_address
                }
            });

            expect(response.statusCode).toBe(201);
            const body = JSON.parse(response.payload);
            expect(body.success).toBe(true);
            expect(body.status).toBe('staging');
            expect(body.factory_name).toBe(factory.name);
        });

        it('should return existing status for already registered PDA', async () => {
            const factory = await createTestFactory();
            const device = await createTestDevice(factory._id);
            const pdaSerial = `PDA_${Date.now()}`;

            // First registration
            await app.inject({
                method: 'POST',
                url: '/api/v1/pda/register',
                payload: {
                    pda_serial: pdaSerial,
                    bluetooth_mac_address: device.bluetooth_mac_address
                }
            });

            // Second registration (same PDA, same factory)
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/pda/register',
                payload: {
                    pda_serial: pdaSerial,
                    bluetooth_mac_address: device.bluetooth_mac_address
                }
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.status).toBe('staging');
        });

        it('should move PDA to staging for new factory when connecting to different factory device', async () => {
            const factory1 = await createTestFactory({ name: 'Factory 1' });
            const factory2 = await createTestFactory({ name: 'Factory 2' });
            const device1 = await createTestDevice(factory1._id);
            const device2 = await createTestDevice(factory2._id);
            const pdaSerial = `PDA_${Date.now()}`;

            // Register with first factory
            await app.inject({
                method: 'POST',
                url: '/api/v1/pda/register',
                payload: {
                    pda_serial: pdaSerial,
                    bluetooth_mac_address: device1.bluetooth_mac_address
                }
            });

            // Connect to second factory device
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/pda/register',
                payload: {
                    pda_serial: pdaSerial,
                    bluetooth_mac_address: device2.bluetooth_mac_address
                }
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.status).toBe('staging');
            expect(body.factory_name).toBe('Factory 2');
            expect(body.message).toContain('new factory');
        });
    });
});

describe('PDA Status Endpoint', () => {
    describe('GET /api/v1/pda/:serial/status', () => {
        it('should return 404 for non-existent PDA', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/pda/NONEXISTENT/status'
            });

            expect(response.statusCode).toBe(404);
            const body = JSON.parse(response.payload);
            expect(body.status).toBe('unregistered');
        });

        it('should return staging status for unapproved PDA', async () => {
            const factory = await createTestFactory();
            const pda = await createTestPDA(factory._id);

            const response = await app.inject({
                method: 'GET',
                url: `/api/v1/pda/${pda.serial_number}/status`
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.status).toBe('staging');
            expect(body.api_key).toBeUndefined();
        });

        it('should return approved status with API key for approved PDA', async () => {
            const factory = await createTestFactory();
            const { pda, apiKey } = await createApprovedPDA(factory._id);

            const response = await app.inject({
                method: 'GET',
                url: `/api/v1/pda/${pda.serial_number}/status`
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.status).toBe('approved');
            expect(body.api_key).toBe(apiKey);
        });
    });
});

describe('PDA Devices Endpoint', () => {
    describe('GET /api/v1/pda/:serial/devices', () => {
        it('should return 401 without API key', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/pda/PDA123/devices'
            });

            expect(response.statusCode).toBe(401);
        });

        it('should return 401 with invalid API key', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/pda/PDA123/devices',
                headers: {
                    'x-pda-api-key': 'invalid_key'
                }
            });

            expect(response.statusCode).toBe(401);
        });

        it('should return factory devices with valid API key', async () => {
            const factory = await createTestFactory();
            const device1 = await createTestDevice(factory._id);
            const device2 = await createTestDevice(factory._id);
            const { pda, apiKey } = await createApprovedPDA(factory._id);

            const response = await app.inject({
                method: 'GET',
                url: `/api/v1/pda/${pda.serial_number}/devices`,
                headers: {
                    'x-pda-api-key': apiKey
                }
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.success).toBe(true);
            expect(body.results).toHaveLength(2);
            expect(body.results[0].bluetooth_mac_address).toBeDefined();
        });

        it('should only return devices from PDAs factory', async () => {
            const factory1 = await createTestFactory({ name: 'Factory 1' });
            const factory2 = await createTestFactory({ name: 'Factory 2' });
            await createTestDevice(factory1._id);
            await createTestDevice(factory2._id);
            const { pda, apiKey } = await createApprovedPDA(factory1._id);

            const response = await app.inject({
                method: 'GET',
                url: `/api/v1/pda/${pda.serial_number}/devices`,
                headers: {
                    'x-pda-api-key': apiKey
                }
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.results).toHaveLength(1);
            expect(body.factory_name).toBe('Factory 1');
        });
    });
});

describe('PDA Approval Endpoint', () => {
    describe('POST /api/v1/pda/:serial/approve', () => {
        it('should return 401 without authentication', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/pda/PDA123/approve'
            });

            expect(response.statusCode).toBe(401);
        });

        it('should approve PDA and generate API key', async () => {
            const { user, token } = await createTestUser();
            const factory = await createTestFactory();
            const pda = await createTestPDA(factory._id);

            const response = await app.inject({
                method: 'POST',
                url: `/api/v1/pda/${pda.serial_number}/approve`,
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.success).toBe(true);
            expect(body.pda.status).toBe('approved');
        });

        it('should return 404 for non-existent PDA', async () => {
            const { user, token } = await createTestUser();

            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/pda/NONEXISTENT/approve',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            expect(response.statusCode).toBe(404);
        });

        it('should return 400 if PDA already approved', async () => {
            const { user, token } = await createTestUser();
            const factory = await createTestFactory();
            const { pda } = await createApprovedPDA(factory._id);

            const response = await app.inject({
                method: 'POST',
                url: `/api/v1/pda/${pda.serial_number}/approve`,
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            expect(response.statusCode).toBe(400);
        });
    });
});

describe('PDA Disable/Enable Endpoints', () => {
    describe('POST /api/v1/pda/:serial/disable', () => {
        it('should disable an approved PDA', async () => {
            const { user, token } = await createTestUser();
            const factory = await createTestFactory();
            const { pda } = await createApprovedPDA(factory._id);

            const response = await app.inject({
                method: 'POST',
                url: `/api/v1/pda/${pda.serial_number}/disable`,
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.success).toBe(true);
        });
    });

    describe('POST /api/v1/pda/:serial/enable', () => {
        it('should enable a disabled PDA', async () => {
            const { user, token } = await createTestUser();
            const factory = await createTestFactory();
            const { pda } = await createApprovedPDA(factory._id);

            // First disable
            await app.inject({
                method: 'POST',
                url: `/api/v1/pda/${pda.serial_number}/disable`,
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            // Then enable
            const response = await app.inject({
                method: 'POST',
                url: `/api/v1/pda/${pda.serial_number}/enable`,
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.success).toBe(true);
        });

        it('should return 400 if PDA is not disabled', async () => {
            const { user, token } = await createTestUser();
            const factory = await createTestFactory();
            const { pda } = await createApprovedPDA(factory._id);

            const response = await app.inject({
                method: 'POST',
                url: `/api/v1/pda/${pda.serial_number}/enable`,
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            expect(response.statusCode).toBe(400);
        });
    });
});

describe('PDA List Endpoint', () => {
    describe('GET /api/v1/pda/', () => {
        it('should return 401 without authentication', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/pda/'
            });

            expect(response.statusCode).toBe(401);
        });

        it('should return paginated list of PDAs', async () => {
            const { user, token } = await createTestUser();
            const factory = await createTestFactory();
            await createTestPDA(factory._id);
            await createTestPDA(factory._id);

            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/pda/',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.success).toBe(true);
            expect(body.results.docs).toHaveLength(2);
        });

        it('should filter by status', async () => {
            const { user, token } = await createTestUser();
            const factory = await createTestFactory();
            await createTestPDA(factory._id, { status: 'staging' });
            await createApprovedPDA(factory._id);

            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/pda/?status=staging',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.results.docs).toHaveLength(1);
            expect(body.results.docs[0].status).toBe('staging');
        });
    });
});

describe('Sync Unregistered BT Attempts', () => {
    describe('POST /api/v1/pda/sync/unregistered-attempts', () => {
        it('should return 401 without API key', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/pda/sync/unregistered-attempts',
                payload: {
                    attempts: []
                }
            });

            expect(response.statusCode).toBe(401);
        });

        it('should log unregistered BT attempts', async () => {
            const factory = await createTestFactory();
            const { pda, apiKey } = await createApprovedPDA(factory._id);

            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/pda/sync/unregistered-attempts',
                headers: {
                    'x-pda-api-key': apiKey
                },
                payload: {
                    attempts: [
                        { mac_address: 'XX:XX:XX:XX:XX:01', attempted_at: new Date() },
                        { mac_address: 'XX:XX:XX:XX:XX:02', attempted_at: new Date() }
                    ]
                }
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.success).toBe(true);
            expect(body.synced_count).toBe(2);
        });
    });
});
