/**
 * Tests for ECDH and HKDF key derivation
 * 
 * These tests verify that:
 * 1. ECDH shared secret derivation works correctly
 * 2. Both parties derive the same shared secret
 * 3. HKDF session key derivation is consistent
 * 4. Conversation IDs are properly generated
 */

import { describe, it, expect } from 'vitest';
import {
  deriveSharedSecret,
  deriveSessionKey,
  generateSalt,
  createConversationId,
} from './key-derivation.js';
import { generateX25519KeyPair } from './key-generation.js';
import { CryptoError, CryptoErrorCode } from './types.js';

describe('ECDH Shared Secret Derivation', () => {
  it('should derive a 32-byte shared secret', async () => {
    const aliceKeyPair = await generateX25519KeyPair();
    const bobKeyPair = await generateX25519KeyPair();
    
    const sharedSecret = deriveSharedSecret(
      aliceKeyPair.privateKey,
      bobKeyPair.publicKey
    );
    
    expect(sharedSecret).toBeInstanceOf(Uint8Array);
    expect(sharedSecret.length).toBe(32);
  });
  
  it('should derive the same shared secret for both parties', async () => {
    const aliceKeyPair = await generateX25519KeyPair();
    const bobKeyPair = await generateX25519KeyPair();
    
    // Alice derives shared secret using her private key and Bob's public key
    const aliceSharedSecret = deriveSharedSecret(
      aliceKeyPair.privateKey,
      bobKeyPair.publicKey
    );
    
    // Bob derives shared secret using his private key and Alice's public key
    const bobSharedSecret = deriveSharedSecret(
      bobKeyPair.privateKey,
      aliceKeyPair.publicKey
    );
    
    // Both should arrive at the same shared secret
    expect(aliceSharedSecret).toEqual(bobSharedSecret);
  });
  
  it('should derive different shared secrets for different key pairs', async () => {
    const aliceKeyPair = await generateX25519KeyPair();
    const bobKeyPair = await generateX25519KeyPair();
    const charlieKeyPair = await generateX25519KeyPair();
    
    const aliceBobSecret = deriveSharedSecret(
      aliceKeyPair.privateKey,
      bobKeyPair.publicKey
    );
    
    const aliceCharlieSecret = deriveSharedSecret(
      aliceKeyPair.privateKey,
      charlieKeyPair.publicKey
    );
    
    expect(aliceBobSecret).not.toEqual(aliceCharlieSecret);
  });
  
  it('should throw CryptoError for invalid private key', () => {
    const bobKeyPair = generateX25519KeyPair();
    const invalidPrivateKey = new Uint8Array(16); // Wrong size
    
    expect(() => {
      deriveSharedSecret(invalidPrivateKey, bobKeyPair.publicKey);
    }).toThrow(CryptoError);
  });
  
  it('should throw CryptoError for invalid public key', () => {
    const aliceKeyPair = generateX25519KeyPair();
    const invalidPublicKey = new Uint8Array(16); // Wrong size
    
    expect(() => {
      deriveSharedSecret(aliceKeyPair.privateKey, invalidPublicKey);
    }).toThrow(CryptoError);
  });
});

describe('HKDF Session Key Derivation', () => {
  it('should derive a 32-byte session key', () => {
    const sharedSecret = new Uint8Array(32);
    crypto.getRandomValues(sharedSecret);
    const salt = generateSalt();
    const conversationId = 'alice_bob';
    
    const sessionKey = deriveSessionKey(sharedSecret, salt, conversationId);
    
    expect(sessionKey).toBeInstanceOf(Uint8Array);
    expect(sessionKey.length).toBe(32);
  });
  
  it('should derive the same session key with the same inputs', () => {
    const sharedSecret = new Uint8Array(32);
    crypto.getRandomValues(sharedSecret);
    const salt = generateSalt();
    const conversationId = 'alice_bob';
    
    const sessionKey1 = deriveSessionKey(sharedSecret, salt, conversationId);
    const sessionKey2 = deriveSessionKey(sharedSecret, salt, conversationId);
    
    expect(sessionKey1).toEqual(sessionKey2);
  });
  
  it('should derive different session keys with different salts', () => {
    const sharedSecret = new Uint8Array(32);
    crypto.getRandomValues(sharedSecret);
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    const conversationId = 'alice_bob';
    
    const sessionKey1 = deriveSessionKey(sharedSecret, salt1, conversationId);
    const sessionKey2 = deriveSessionKey(sharedSecret, salt2, conversationId);
    
    expect(sessionKey1).not.toEqual(sessionKey2);
  });
  
  it('should derive different session keys with different conversation IDs', () => {
    const sharedSecret = new Uint8Array(32);
    crypto.getRandomValues(sharedSecret);
    const salt = generateSalt();
    
    const sessionKey1 = deriveSessionKey(sharedSecret, salt, 'alice_bob');
    const sessionKey2 = deriveSessionKey(sharedSecret, salt, 'alice_charlie');
    
    expect(sessionKey1).not.toEqual(sessionKey2);
  });
  
  it('should throw CryptoError for invalid shared secret', () => {
    const invalidSharedSecret = new Uint8Array(16); // Wrong size
    const salt = generateSalt();
    const conversationId = 'alice_bob';
    
    expect(() => {
      deriveSessionKey(invalidSharedSecret, salt, conversationId);
    }).toThrow(CryptoError);
  });
  
  it('should throw CryptoError for salt that is too short', () => {
    const sharedSecret = new Uint8Array(32);
    crypto.getRandomValues(sharedSecret);
    const invalidSalt = new Uint8Array(8); // Too short
    const conversationId = 'alice_bob';
    
    expect(() => {
      deriveSessionKey(sharedSecret, invalidSalt, conversationId);
    }).toThrow(CryptoError);
  });
});

describe('Salt Generation', () => {
  it('should generate a 32-byte salt by default', () => {
    const salt = generateSalt();
    
    expect(salt).toBeInstanceOf(Uint8Array);
    expect(salt.length).toBe(32);
  });
  
  it('should generate salts of specified length', () => {
    const salt16 = generateSalt(16);
    const salt64 = generateSalt(64);
    
    expect(salt16.length).toBe(16);
    expect(salt64.length).toBe(64);
  });
  
  it('should generate different salts each time', () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    
    expect(salt1).not.toEqual(salt2);
  });
});

describe('Conversation ID Generation', () => {
  it('should create a deterministic conversation ID', () => {
    const conversationId1 = createConversationId('alice', 'bob');
    const conversationId2 = createConversationId('bob', 'alice');
    
    expect(conversationId1).toBe(conversationId2);
    expect(conversationId1).toBe('alice_bob');
  });
  
  it('should sort user IDs alphabetically', () => {
    const conversationId = createConversationId('zoe', 'alice');
    
    expect(conversationId).toBe('alice_zoe');
  });
  
  it('should handle same user IDs', () => {
    const conversationId = createConversationId('alice', 'alice');
    
    expect(conversationId).toBe('alice_alice');
  });
});

describe('End-to-End Key Exchange Flow', () => {
  it('should complete a full ECDH + HKDF key exchange between two users', async () => {
    // Step 1: Both users generate key pairs
    const aliceKeyPair = await generateX25519KeyPair();
    const bobKeyPair = await generateX25519KeyPair();
    
    // Step 2: They exchange public keys (simulated)
    // In practice, these would be sent via the server
    
    // Step 3: Both users derive the same shared secret
    const aliceSharedSecret = deriveSharedSecret(
      aliceKeyPair.privateKey,
      bobKeyPair.publicKey
    );
    const bobSharedSecret = deriveSharedSecret(
      bobKeyPair.privateKey,
      aliceKeyPair.publicKey
    );
    
    expect(aliceSharedSecret).toEqual(bobSharedSecret);
    
    // Step 4: Both users derive the same session key
    const salt = generateSalt();
    const conversationId = createConversationId('alice', 'bob');
    
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
    
    expect(aliceSessionKey).toEqual(bobSessionKey);
    
    // Step 5: Both users can now use this session key for AES-256-GCM encryption
    expect(aliceSessionKey.length).toBe(32); // 256 bits
  });
});
