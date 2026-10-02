# @nextalk/crypto

Shared cryptographic utilities package for NexTalk end-to-end encryption.

## Features

- **X25519 ECDH Key Exchange**: Efficient elliptic curve Diffie-Hellman for deriving shared secrets
- **HKDF Key Derivation**: HMAC-based key derivation for generating session keys
- **AES-256-GCM Encryption**: Authenticated encryption with associated data
- **Cross-Platform**: Works on Web (Next.js) and React Native (Expo)
- **Type-Safe**: Full TypeScript support

## Installation

This package is part of the NexTalk monorepo and should be used via workspace references.

### Dependencies

The package uses:
- `@noble/curves` - Audited, performant elliptic curve implementation
- `@noble/hashes` - Cryptographic hash functions and utilities

## Usage

### Generate Key Pair

```typescript
import { generateX25519KeyPair } from '@nextalk/crypto';

const keyPair = generateX25519KeyPair();
// Store privateKey securely (IndexedDB on web, SecureStore on mobile)
// Upload publicKey to server
```

### Derive Shared Secret and Session Key

```typescript
import {
  deriveSharedSecret,
  deriveSessionKey,
  generateSalt,
  createConversationId,
} from '@nextalk/crypto';

// Get other user's public key from server
const sharedSecret = deriveSharedSecret(
  myKeyPair.privateKey,
  theirPublicKey
);

// Generate unique conversation ID
const conversationId = createConversationId(myUserId, theirUserId);

// Derive session key
const salt = generateSalt();
const sessionKey = deriveSessionKey(sharedSecret, salt, conversationId);
```

### Encryption (Platform-Specific)

The encryption functions (`encryptMessage`, `decryptMessage`) are platform-agnostic interfaces. You must implement platform-specific adapters:

**Web (Web Crypto API):**
```typescript
import { generateIV } from '@nextalk/crypto';

async function encryptMessageWeb(
  plaintext: string,
  sessionKey: Uint8Array,
  salt: Uint8Array
): Promise<EncryptedMessage> {
  const iv = generateIV();
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    sessionKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  );
  
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
    salt: bytesToBase64(salt),
  };
}
```

## Security Considerations

### Key Storage
- **Private keys**: Must be stored in secure, non-extractable storage
  - Web: IndexedDB with encryption
  - Mobile: Expo SecureStore or platform keychain
- **Public keys**: Can be stored in PostgreSQL
- **Session keys**: Derived on-demand, not persisted

### Forward Secrecy
- Session keys should be rotated every 100 messages or 24 hours
- Old session keys must be securely zeroed out after rotation
- Use `secureZero()` utility to overwrite key material in memory

### Conversation Isolation
- Each conversation derives a unique session key using the conversation ID
- Compromising one conversation's key does not expose other conversations

## Architecture

```
User A                          User B
  |                               |
  | 1. Generate X25519 keypair    |
  |                               |
  | 2. Exchange public keys (via server)
  |                               |
  | 3. ECDH: derive shared secret |
  |    sharedSecret = ECDH(A.priv, B.pub)
  |                               |
  | 4. HKDF: derive session key   |
  |    sessionKey = HKDF(sharedSecret, salt, conversationId)
  |                               |
  | 5. Encrypt message            |
  |    ciphertext = AES-GCM(msg, sessionKey, iv)
  |                               |
  | 6. Send encrypted message (server cannot decrypt)
  |                               |
  |                               | 7. Decrypt message
  |                               |    msg = AES-GCM(ciphertext, sessionKey, iv)
```

## Cryptographic Primitives

- **Key Exchange**: X25519 (Curve25519 ECDH)
- **Key Derivation**: HKDF-SHA-256
- **Encryption**: AES-256-GCM
- **Random Generation**: Cryptographically secure random bytes

## Testing

Run tests from the package directory:

```bash
npm test
```

## License

Private - Part of NexTalk platform
