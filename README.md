# Bytronics Anti-Tamper Backend

Backend API service for the Bytronics Anti-Tamper system. Handles PDA registration, device validation, and factory management.

## Setup

1. Copy `.env.example` to `.env` and configure the values
2. Install dependencies: `npm install`
3. Run in development: `npm run dev`
4. Run in production: `npm run production`

## Testing

```bash
npm test                    # Run all tests
npm run test:watch          # Run tests in watch mode
npm run test:coverage       # Run tests with coverage report
```

## M2M Encryption

The backend supports end-to-end encrypted communication with the Android SDK for machine-to-machine (M2M) endpoints.

### Overview

All M2M API traffic between the SDK and backend is encrypted using AES-256-GCM. This provides:
- **Confidentiality**: Payloads cannot be read by intermediaries
- **Integrity**: Tampered payloads are rejected
- **Authentication**: Only parties with the shared key can communicate

### Encrypted Endpoints

The following endpoints use M2M encryption:
- `POST /api/v1/pda/register` - PDA registration
- `GET /api/v1/pda/:serial/status` - PDA status check
- `GET /api/v1/pda/:serial/devices` - Get allowed devices
- `POST /api/v1/pda/sync/unregistered-attempts` - Sync unregistered BT attempts
- `POST /api/v1/devices/m2m/verify` - Device verification

### Configuration

Set the `M2M_ENCRYPTION_KEY` environment variable:

```bash
# Generate a new key (64 hex characters = 32 bytes)
openssl rand -hex 32

# Add to .env
M2M_ENCRYPTION_KEY=your_64_hex_character_key_here
```

**Important**: The same key must be embedded in the SDK's native library. When rotating keys, both the backend and SDK must be updated together.

### Wire Format

```
Request/Response Body:
Base64( version[1] || nonce[12] || ciphertext || tag[16] )

- version: 0x01 (1 byte) - protocol version
- nonce: 12 random bytes (unique per request)
- ciphertext: AES-256-GCM encrypted JSON
- tag: 16 byte authentication tag
```

### Headers

Encrypted requests use:
```
Content-Type: application/x-bytronics-encrypted
```

Encrypted responses include:
```
X-Encryption-Version: 1
```

### Backward Compatibility

The middleware supports both encrypted and unencrypted requests:
- `Content-Type: application/x-bytronics-encrypted` - Decrypted and processed
- `Content-Type: application/json` - Passed through unchanged

This allows gradual SDK rollout without breaking older versions.

### Disabling Encryption

To disable M2M encryption (not recommended for production):
- Remove or leave empty the `M2M_ENCRYPTION_KEY` environment variable
- The middleware will pass all requests through unchanged

## API Documentation

See the `/docs` folder for detailed API documentation.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | Yes |
| `DEV` | Enable development mode | No |
| `DB_IP` | MongoDB host | Yes |
| `DB_PORT` | MongoDB port | Yes |
| `DB_USER` | MongoDB username | Yes |
| `DB_PASSWORD` | MongoDB password | Yes |
| `DB_NAME` | Database name | Yes |
| `SECRET_KEY` | JWT signing key | Yes |
| `M2M_ENCRYPTION_KEY` | AES-256 key for SDK encryption (64 hex chars) | Yes* |
| `AES_KEY` | Legacy AES key | No |

*Required for encrypted SDK communication
