# AES-256-GCM Encryption Usage Guide

This document shows how to use the encryption/decryption functions in the `@nextalk/crypto` package.

## Complete E2E Encryption Flow

```typescript
import {
  generateX25519KeyPair,
  deriveSharedSecret,
  deriveSessionKey,
  generateSalt,
  encryptMessage,
  decryptMessage,
  createConversationId
} from '@nextalk/crypto';

// 1. Each user generates their X25519 key pair (done once)
const aliceKeyPair = generateX25519KeyPair();
const bobKeyPair = generateX25519KeyPair();

// 2. Users exchange public keys (via server, which stores them)
// aliceKeyPair.publicKey → server → bob
// bobKeyPair.publicKey → server → alice

// 3. Both users derive the same shared secret via ECDH
const aliceSharedSecret = deriveSharedSecret(
  aliceKeyPair.privateKey,
  bobKeyPair.publicKey
);

const bobSharedSecret = deriveSharedSecret(
  bobKeyPair.privateKey,
  aliceKeyPair.publicKey
);

// These are equal! Both parties have the same shared secret
console.log(aliceSharedSecret.toString() === bobSharedSecret.toString()); // true

// 4. Derive session key from shared secret using HKDF
const salt = generateSalt(); // Random 32-byte salt
const conversationId = createConversationId('alice_id', 'bob_id');

const aliceSessionKey = deriveSessionKey(
  aliceSharedSecret,
  salt,
  conversationId
);

const bobSessionKey = deriveSessionKey(
  bobSharedSecret,
  salt,
  conversationId
);

// Session keys are equal!
console.log(aliceSessionKey.toString() === bobSessionKey.toString()); // true

// 5. Alice encrypts a message
const plaintext = "Hey Bob, this is a secret message!";
const encrypted = await encryptMessage(plaintext, aliceSessionKey, salt);

// encrypted = {
//   ciphertext: "base64...",
//   iv: "base64...",
//   salt: "base64..."
// }

// 6. Alice sends encrypted message to server, server forwards to Bob
// Server only sees ciphertext - cannot decrypt!

// 7. Bob decrypts the message
const decrypted = await decryptMessage(encrypted, bobSessionKey);
console.log(decrypted); // "Hey Bob, this is a secret message!"
```

## Encryption Only

If you already have a session key (e.g., from ECDH + HKDF):

```typescript
import { encryptMessage, generateSalt } from '@nextalk/crypto';

const plaintext = "Hello, world!";
const sessionKey = new Uint8Array(32); // Your 32-byte AES-256 key
const salt = generateSalt();

const encrypted = await encryptMessage(plaintext, sessionKey, salt);

console.log(encrypted);
// {
//   ciphertext: "XYZ123...",
//   iv: "ABC789...",
//   salt: "DEF456..."
// }
```

## Decryption Only

```typescript
import { decryptMessage } from '@nextalk/crypto';

const encrypted = {
  ciphertext: "XYZ123...",
  iv: "ABC789...",
  salt: "DEF456..."
};

const sessionKey = new Uint8Array(32); // Same key used for encryption

const plaintext = await decryptMessage(encrypted, sessionKey);
console.log(plaintext); // "Hello, world!"
```

## Error Handling

```typescript
import { decryptMessage } from '@nextalk/crypto';

const encrypted = {
  ciphertext: "XYZ123...",
  iv: "ABC789...",
  salt: "DEF456..."
};

const wrongKey = new Uint8Array(32); // Different key

const result = await decryptMessage(encrypted, wrongKey);
console.log(result); // "[Unable to decrypt message]"
```

The decryption function gracefully handles failures and returns a placeholder string instead of throwing errors. This matches the design requirement from the spec.

## Key Properties

- **Random IVs**: Each encryption generates a fresh random 96-bit (12-byte) IV
- **Authenticated Encryption**: AES-GCM provides both confidentiality and authenticity
- **No IV Reuse**: Same plaintext encrypted twice produces different ciphertexts
- **Graceful Failures**: Decryption failures return "[Unable to decrypt message]"
- **Session Key Size**: Must be exactly 32 bytes (256 bits)
- **IV Size**: Always 12 bytes (96 bits) for optimal GCM performance

## Integration with Web App

In your Next.js app, you can use these functions in client-side components:

```typescript
// components/chat/DMComposer.tsx
import { encryptMessage } from '@nextalk/crypto';

async function sendEncryptedDM(
  content: string,
  sessionKey: Uint8Array,
  salt: Uint8Array
) {
  const encrypted = await encryptMessage(content, sessionKey, salt);
  
  // Send to server
  await fetch('/api/messages', {
    method: 'POST',
    body: JSON.stringify({
      content: encrypted.ciphertext,
      iv: encrypted.iv,
      salt: encrypted.salt,
      encrypted: true
    })
  });
}
```

```typescript
// components/chat/MessageList.tsx
import { decryptMessage } from '@nextalk/crypto';

async function decryptDM(
  encrypted: { ciphertext: string; iv: string; salt: string },
  sessionKey: Uint8Array
): Promise<string> {
  return await decryptMessage(encrypted, sessionKey);
}
```

## Security Notes

1. **Server Cannot Decrypt**: The server only sees ciphertext, IV, and salt. It cannot decrypt messages without the session key.
2. **Session Keys Never Leave Client**: Session keys are derived client-side and never transmitted.
3. **Forward Secrecy**: Rotate session keys periodically (every 100 messages or 24 hours).
4. **Key Storage**: Private keys should be stored in IndexedDB (Web) or secure storage (React Native).
5. **Metadata Leakage**: Server can see message timing, size, and conversation participants (but not content).

## Testing

The package includes comprehensive unit tests:

```bash
npm test -- packages/crypto/src/encryption.test.ts --run
```

Tests cover:
- ✅ Successful encryption/decryption round-trip
- ✅ Different ciphertexts for same plaintext (IV randomness)
- ✅ Decryption failure with wrong key
- ✅ Empty plaintext validation
- ✅ Long messages (10KB+)
- ✅ Unicode characters
- ✅ Invalid key size handling
- ✅ Corrupted ciphertext handling
- ✅ IV generation (12 bytes)
