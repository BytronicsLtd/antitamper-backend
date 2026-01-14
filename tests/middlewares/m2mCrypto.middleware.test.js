/**
 * Unit tests for M2M Crypto Middleware
 *
 * Tests the Fastify middleware that handles transparent encryption/decryption
 * for SDK <-> Backend M2M communication.
 */

const {
    m2mCrypto,
    optionalM2mCrypto,
    ENCRYPTED_CONTENT_TYPE,
    ENCRYPTION_VERSION_HEADER
} = require('../../src/middlewares/m2mCrypto.middleware');
const { encrypt, decrypt } = require('../../src/utils/m2mCrypto.util');

describe('M2M Crypto Middleware', () => {
    describe('Constants', () => {
        it('should export correct content type', () => {
            expect(ENCRYPTED_CONTENT_TYPE).toBe('application/x-bytronics-encrypted');
        });

        it('should export correct header name', () => {
            expect(ENCRYPTION_VERSION_HEADER).toBe('x-encryption-version');
        });
    });

    describe('m2mCrypto middleware', () => {
        let mockRequest;
        let mockReply;

        beforeEach(() => {
            mockRequest = {
                headers: {},
                body: null,
                isEncrypted: false
            };
            mockReply = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn().mockReturnThis(),
                header: jest.fn().mockReturnThis(),
                type: jest.fn().mockReturnThis()
            };
        });

        describe('Request decryption', () => {
            it('should reject non-encrypted requests with 403 when encryption is enabled', async () => {
                mockRequest.headers['content-type'] = 'application/json';
                mockRequest.body = { test: 'data' };

                await m2mCrypto(mockRequest, mockReply);

                expect(mockReply.status).toHaveBeenCalledWith(403);
                expect(mockReply.send).toHaveBeenCalledWith(
                    expect.objectContaining({
                        success: false,
                        message: 'Encryption required. Use Content-Type: application/x-bytronics-encrypted'
                    })
                );
            });

            it('should decrypt encrypted requests', async () => {
                const originalData = { message: 'hello', id: 123 };
                const encryptedBody = encrypt(originalData);

                mockRequest.headers['content-type'] = ENCRYPTED_CONTENT_TYPE;
                mockRequest.body = encryptedBody;

                await m2mCrypto(mockRequest, mockReply);

                expect(mockRequest.body).toEqual(originalData);
                expect(mockRequest.isEncrypted).toBe(true);
            });

            it('should return 400 for missing encrypted body', async () => {
                mockRequest.headers['content-type'] = ENCRYPTED_CONTENT_TYPE;
                mockRequest.body = null;

                await m2mCrypto(mockRequest, mockReply);

                expect(mockReply.status).toHaveBeenCalledWith(400);
                expect(mockReply.send).toHaveBeenCalledWith(
                    expect.objectContaining({
                        success: false,
                        message: 'Missing encrypted request body'
                    })
                );
            });

            it('should return 400 for invalid encrypted body', async () => {
                mockRequest.headers['content-type'] = ENCRYPTED_CONTENT_TYPE;
                mockRequest.body = 'invalid_encrypted_data';

                await m2mCrypto(mockRequest, mockReply);

                expect(mockReply.status).toHaveBeenCalledWith(400);
                expect(mockReply.send).toHaveBeenCalledWith(
                    expect.objectContaining({
                        success: false,
                        message: 'Failed to decrypt request'
                    })
                );
            });

            it('should return 400 for tampered encrypted body', async () => {
                const originalData = { test: 'data' };
                const encrypted = encrypt(originalData);
                const payload = Buffer.from(encrypted, 'base64');

                // Tamper with the ciphertext
                payload[15] ^= 0xFF;

                mockRequest.headers['content-type'] = ENCRYPTED_CONTENT_TYPE;
                mockRequest.body = payload.toString('base64');

                await m2mCrypto(mockRequest, mockReply);

                expect(mockReply.status).toHaveBeenCalledWith(400);
            });
        });

        describe('Response encryption', () => {
            it('should set encryption header for encrypted requests', async () => {
                const originalData = { test: 'data' };
                const encryptedBody = encrypt(originalData);

                mockRequest.headers['content-type'] = ENCRYPTED_CONTENT_TYPE;
                mockRequest.body = encryptedBody;

                await m2mCrypto(mockRequest, mockReply);

                expect(mockReply.header).toHaveBeenCalledWith(
                    ENCRYPTION_VERSION_HEADER,
                    '1'
                );
            });

            it('should wrap reply.send to encrypt responses', async () => {
                const originalData = { request: 'data' };
                const encryptedBody = encrypt(originalData);

                mockRequest.headers['content-type'] = ENCRYPTED_CONTENT_TYPE;
                mockRequest.body = encryptedBody;

                await m2mCrypto(mockRequest, mockReply);

                // Verify reply.send was overwritten
                const responseData = { success: true, data: 'response' };

                // Track what gets passed to original send
                let sentPayload = null;
                mockReply.send = (payload) => {
                    sentPayload = payload;
                    return mockReply;
                };

                // Re-run to set up the new send wrapper
                mockRequest.body = encryptedBody;
                await m2mCrypto(mockRequest, mockReply);

                // Now the new send should encrypt
                mockReply.send(responseData);

                // sentPayload should be encrypted (string)
                expect(typeof sentPayload).toBe('string');

                // Should be decryptable back to original response
                const decrypted = decrypt(sentPayload);
                expect(decrypted).toEqual(responseData);
            });

            it('should not encrypt non-object responses', async () => {
                const originalData = { test: 'data' };
                const encryptedBody = encrypt(originalData);

                mockRequest.headers['content-type'] = ENCRYPTED_CONTENT_TYPE;
                mockRequest.body = encryptedBody;

                let sentPayload = null;
                const originalSend = jest.fn((payload) => {
                    sentPayload = payload;
                    return mockReply;
                });
                mockReply.send = originalSend;

                await m2mCrypto(mockRequest, mockReply);

                // Send a string (non-object)
                mockReply.send('plain text response');

                expect(sentPayload).toBe('plain text response');
            });
        });

        describe('Encryption disabled (backward compatibility)', () => {
            it('should allow non-encrypted requests when encryption is disabled', async () => {
                const originalKey = process.env.M2M_ENCRYPTION_KEY;
                delete process.env.M2M_ENCRYPTION_KEY;

                mockRequest.headers['content-type'] = 'application/json';
                mockRequest.body = { test: 'data' };

                await m2mCrypto(mockRequest, mockReply);

                // Should pass through without rejection
                expect(mockRequest.body).toEqual({ test: 'data' });
                expect(mockReply.status).not.toHaveBeenCalled();

                process.env.M2M_ENCRYPTION_KEY = originalKey;
            });

            it('should skip decryption processing when encryption is disabled', async () => {
                const originalKey = process.env.M2M_ENCRYPTION_KEY;
                delete process.env.M2M_ENCRYPTION_KEY;

                mockRequest.headers['content-type'] = ENCRYPTED_CONTENT_TYPE;
                mockRequest.body = 'some_body';

                await m2mCrypto(mockRequest, mockReply);

                // Should return early without processing
                expect(mockRequest.isEncrypted).toBeFalsy();
                expect(mockReply.status).not.toHaveBeenCalled();

                process.env.M2M_ENCRYPTION_KEY = originalKey;
            });
        });
    });

    describe('optionalM2mCrypto middleware', () => {
        let mockRequest;
        let mockReply;

        beforeEach(() => {
            mockRequest = {
                headers: {},
                body: null,
                isEncrypted: false
            };
            mockReply = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn().mockReturnThis(),
                header: jest.fn().mockReturnThis(),
                type: jest.fn().mockReturnThis()
            };
        });

        it('should decrypt valid encrypted requests', async () => {
            const originalData = { optional: 'data' };
            const encryptedBody = encrypt(originalData);

            mockRequest.headers['content-type'] = ENCRYPTED_CONTENT_TYPE;
            mockRequest.body = encryptedBody;

            await optionalM2mCrypto(mockRequest, mockReply);

            expect(mockRequest.body).toEqual(originalData);
            expect(mockRequest.isEncrypted).toBe(true);
        });

        it('should not fail on invalid encrypted body (logs warning instead)', async () => {
            // Spy on console.warn
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            mockRequest.headers['content-type'] = ENCRYPTED_CONTENT_TYPE;
            mockRequest.body = 'invalid_encrypted_data';

            await optionalM2mCrypto(mockRequest, mockReply);

            // Should NOT return error
            expect(mockReply.status).not.toHaveBeenCalled();

            // Body should remain unchanged
            expect(mockRequest.body).toBe('invalid_encrypted_data');
            expect(mockRequest.isEncrypted).toBeFalsy();

            // Should have logged warning
            expect(warnSpy).toHaveBeenCalled();

            warnSpy.mockRestore();
        });

        it('should pass through non-encrypted requests', async () => {
            mockRequest.headers['content-type'] = 'application/json';
            mockRequest.body = { plain: 'json' };

            await optionalM2mCrypto(mockRequest, mockReply);

            expect(mockRequest.body).toEqual({ plain: 'json' });
            expect(mockRequest.isEncrypted).toBeFalsy();
        });

        it('should still encrypt response if request was encrypted', async () => {
            const originalData = { test: 'data' };
            const encryptedBody = encrypt(originalData);

            mockRequest.headers['content-type'] = ENCRYPTED_CONTENT_TYPE;
            mockRequest.body = encryptedBody;

            await optionalM2mCrypto(mockRequest, mockReply);

            expect(mockReply.header).toHaveBeenCalledWith(
                ENCRYPTION_VERSION_HEADER,
                '1'
            );
        });
    });

    describe('End-to-end encryption flow', () => {
        it('should handle full request-response cycle', async () => {
            // Simulate encrypted request
            const requestData = {
                serial_number: 'PDA_12345',
                action: 'register'
            };
            const encryptedRequest = encrypt(requestData);

            const mockRequest = {
                headers: { 'content-type': ENCRYPTED_CONTENT_TYPE },
                body: encryptedRequest,
                isEncrypted: false
            };

            let finalResponse = null;
            const mockReply = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn((payload) => {
                    finalResponse = payload;
                    return mockReply;
                }),
                header: jest.fn().mockReturnThis(),
                type: jest.fn().mockReturnThis()
            };

            // Process request
            await m2mCrypto(mockRequest, mockReply);

            // Verify request was decrypted
            expect(mockRequest.body).toEqual(requestData);

            // Simulate controller response
            const responseData = {
                success: true,
                pda_id: 'pda_abc123',
                status: 'staging'
            };

            // Send response (should be encrypted)
            mockReply.send(responseData);

            // Verify response is encrypted
            expect(typeof finalResponse).toBe('string');

            // Decrypt and verify
            const decryptedResponse = decrypt(finalResponse);
            expect(decryptedResponse).toEqual(responseData);
        });

        it('should maintain data integrity through round-trip', async () => {
            const testCases = [
                { simple: 'string' },
                { number: 42, float: 3.14 },
                { boolean: true, null: null },
                { array: [1, 2, 3], nested: { key: 'value' } },
                { unicode: 'Hello World' },
                { mixed: { a: 1, b: 'two', c: [true, null, { d: 4 }] } }
            ];

            for (const testData of testCases) {
                const encrypted = encrypt(testData);

                const mockRequest = {
                    headers: { 'content-type': ENCRYPTED_CONTENT_TYPE },
                    body: encrypted,
                    isEncrypted: false
                };

                const mockReply = {
                    status: jest.fn().mockReturnThis(),
                    send: jest.fn().mockReturnThis(),
                    header: jest.fn().mockReturnThis(),
                    type: jest.fn().mockReturnThis()
                };

                await m2mCrypto(mockRequest, mockReply);

                expect(mockRequest.body).toEqual(testData);
            }
        });
    });
});
