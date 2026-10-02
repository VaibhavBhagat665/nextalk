# React Native E2E Encryption Implementation

## Overview

This document describes the React Native implementation of end-to-end encryption for the NexTalk mobile app. The implementation uses the shared `@nextalk/crypto` package with React Native-specific adaptations.

## Architecture

### Shared Crypto Package
The mobile app uses `@nextalk/crypto` package (located at `packages/crypto/`) which provides:
- X25519 key pair generation using `@noble/curves`
- ECDH key exchange
- HKDF key derivation
- Platform-agnostic interfaces

### React Native Adaptations

#### 1. Key Generation (`mobile/lib/crypto-rn.ts`)
- **Uses**: `@noble/curves` for X25519 (synchronous, pure JavaScript)
- **No Web Crypto API**: React Native doesn't have `crypto.subtle`, so we use `generateX25519KeyPairSync()`
- **Storage**: expo-secure-store for private keys (iOS Keychain / Android Keystore)

#### 2. Encryption/Decryption (`mobile/lib/encryption-rn.ts`)
- **Uses**: `@noble/ciphers` for AES-256-GCM encryption
- **No Web Crypto API**: Pure JavaScript implementation instead of browser native
- **Compatible**: Produces same ciphertext format as web implementation

## Key Components

### 1. Key Storage (`crypto-rn.ts`)

```typescript
// Store private key securely
await storePrivateKey(privateKey: Uint8Array): Promise<void>

// Retrieve private key
await retrievePrivateKey(): Promise<Uint8Array | null>

// Get or create key pair (main entry point)
await getOrCreateKeyPair(): Promise<KeyPair>

// Delete all keys (logout)
await deleteAllKeys(): Promise<void>
```

**Security Features:**
- Private keys stored in device secure enclave (iOS Keychain / Android Keystore)
- Keys never leave the device
- Public keys cached locally but also synced to server

### 2. Message Encryption (`crypto-rn.ts`)

```typescript
// Encrypt a DM
const encrypted = await encryptDM(
  plaintext: string,
  recipientPublicKey: string, // base64
  recipientUserId: string,
  myUserId: string,
  keyVersion: number = 1
): Promise<EncryptedMessage>

// Decrypt a DM
const plaintext = await decryptDM(
  encrypted: EncryptedMessage,
  senderPublicKey: string, // base64
  senderUserId: string,
  myUserId: string
): Promise<string>
```

**Encryption Flow:**
1. Retrieve your private key from SecureStore
2. Decode recipient's public key from base64
3. Perform ECDH: `sharedSecret = x25519(myPrivateKey, theirPublicKey)`
4. Generate random salt
5. Derive session key: `sessionKey = HKDF(sharedSecret, salt, conversationId)`
6. Encrypt message: `{ciphertext, iv} = AES-256-GCM(plaintext, sessionKey)`

**Decryption Flow:**
1. Retrieve your private key from SecureStore
2. Decode sender's public key from base64
3. Perform ECDH to get same shared secret
4. Derive session key using salt from encrypted message
5. Decrypt: `plaintext = AES-256-GCM-decrypt(ciphertext, sessionKey, iv)`

### 3. AES-256-GCM Implementation (`encryption-rn.ts`)

```typescript
// Encrypt with AES-256-GCM
await encryptMessageRN(
  plaintext: string,
  sessionKey: Uint8Array,
  salt: Uint8Array,
  keyVersion: number
): Promise<EncryptedMessage>

// Decrypt with AES-256-GCM
await decryptMessageRN(
  encrypted: EncryptedMessage,
  sessionKey: Uint8Array,
  expectedKeyVersion?: number
): Promise<string>
```

**Implementation Details:**
- Uses `@noble/ciphers/aes` for GCM mode
- 96-bit (12-byte) IV for optimal GCM performance
- Random IV generated for each encryption
- Graceful failure: returns "[Unable to decrypt message]" on decryption errors

## Dependencies

### Required Packages
```json
{
  "@nextalk/crypto": "file:../packages/crypto",
  "expo-secure-store": "^56.0.4"
}
```

### Crypto Package Dependencies
```json
{
  "@noble/ciphers": "^1.3.0",
  "@noble/curves": "^1.9.0",
  "@noble/hashes": "^1.6.3"
}
```

## Testing

### Test Coverage (`mobile/lib/__tests__/crypto-rn.test.ts`)

✅ **Key Storage**
- Store and retrieve private key from SecureStore
- Store and retrieve public key from SecureStore
- Return null when key does not exist
- Delete all keys

✅ **Key Pair Management**
- Generate new key pair when none exists
- Retrieve existing key pair
- Check if encryption is setup
- Get public key as base64

✅ **End-to-End Encryption**
- Encrypt and decrypt a message
- Fail to decrypt with wrong key
- Handle empty message

✅ **Cross-Platform Compatibility**
- Use same key derivation as web
- Use same session key derivation as web
- Create deterministic conversation IDs

✅ **Session Key Isolation**
- Derive different session keys for different conversations

### Running Tests
```bash
cd mobile
npm test -- lib/__tests__/crypto-rn.test.ts
```

**Test Results:** All 15 tests passing ✅

## Usage Example

### Initialize Encryption
```typescript
import { getOrCreateKeyPair, getPublicKeyBase64 } from '@/lib/crypto-rn';

// On app launch, get or create key pair
const keyPair = await getOrCreateKeyPair();

// Upload public key to server
const publicKeyBase64 = await getPublicKeyBase64();
await uploadPublicKeyToServer(publicKeyBase64);
```

### Send Encrypted DM
```typescript
import { encryptDM } from '@/lib/crypto-rn';

// Fetch recipient's public key from server
const recipientPublicKey = await fetchPublicKey(recipientUserId);

// Encrypt message
const encrypted = await encryptDM(
  messageText,
  recipientPublicKey,
  recipientUserId,
  myUserId
);

// Send encrypted message to server
await sendMessage({
  recipientId: recipientUserId,
  content: encrypted.ciphertext,
  iv: encrypted.iv,
  salt: encrypted.salt,
  keyVersion: encrypted.keyVersion,
  encrypted: true
});
```

### Receive Encrypted DM
```typescript
import { decryptDM } from '@/lib/crypto-rn';

// Fetch sender's public key from server
const senderPublicKey = await fetchPublicKey(senderId);

// Decrypt message
const plaintext = await decryptDM(
  {
    ciphertext: message.content,
    iv: message.iv,
    salt: message.salt,
    keyVersion: message.keyVersion
  },
  senderPublicKey,
  senderId,
  myUserId
);

// Display plaintext in UI
// On decryption failure, plaintext will be "[Unable to decrypt message]"
```

## Cross-Platform Compatibility

### Web vs Mobile

| Feature | Web | React Native |
|---------|-----|--------------|
| Key Generation | Web Crypto API (if supported) or @noble/curves | @noble/curves only |
| ECDH | @noble/curves | @noble/curves |
| HKDF | @noble/hashes | @noble/hashes |
| AES-256-GCM | Web Crypto API | @noble/ciphers |
| Private Key Storage | IndexedDB | expo-secure-store |
| Public Key Storage | Server + localStorage cache | Server + SecureStore cache |

**Compatibility Guarantee:**
- Both platforms use the same shared crypto package
- Both derive identical shared secrets (ECDH)
- Both derive identical session keys (HKDF)
- Both produce compatible encrypted messages (AES-256-GCM)
- Web user can encrypt a message that mobile user can decrypt, and vice versa

## Security Considerations

### ✅ Secure Features
1. **Private keys never leave device** - stored in secure enclave
2. **Server cannot decrypt messages** - server only sees ciphertext
3. **Forward secrecy ready** - supports key rotation via keyVersion
4. **ECDH key exchange** - industry-standard X25519
5. **Authenticated encryption** - AES-256-GCM provides confidentiality + authenticity

### ⚠️ Limitations
1. **Metadata visible to server** - message timing, size, participants
2. **No perfect forward secrecy yet** - need to implement key rotation
3. **No key backup** - losing device = losing access to old messages
4. **Channel messages not encrypted** - only DMs are E2E encrypted

### 🔒 Best Practices
1. Rotate session keys every 100 messages or 24 hours
2. Implement key verification UI (safety numbers/fingerprints)
3. Prompt users to back up keys to cloud (encrypted with passphrase)
4. Show clear indicators for encrypted vs unencrypted conversations
5. Educate users about what is and isn't protected

## Requirements Satisfied

This implementation satisfies **Requirement 5.10** from the design document:

> **5.10**: WHEN encrypting DMs THEN the Mobile App SHALL implement the same X25519 ECDH key exchange and E2E encryption as the web app

✅ **Uses @noble/curves** - Pure JavaScript X25519, no Web Crypto API dependency  
✅ **Uses expo-secure-store** - Private keys stored in device secure enclave  
✅ **Shares crypto package** - Web and mobile use same `@nextalk/crypto` package  
✅ **Cross-platform compatible** - Mobile can decrypt web messages and vice versa  
✅ **Comprehensive tests** - 15 tests covering all functionality  

## Next Steps

1. **Integrate with UI** - Add encryption to DM components
2. **Key rotation** - Implement session key rotation every 100 messages/24 hours
3. **Safety numbers** - Add key verification UI for user verification
4. **Key backup** - Implement secure key backup to user's cloud storage
5. **Performance testing** - Measure encryption overhead on low-end devices
