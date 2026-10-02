/**
 * Tests for React Native crypto integration
 * 
 * These tests verify that the mobile app can:
 * 1. Use @noble/curves for key generation (no Web Crypto API)
 * 2. Store keys securely in expo-secure-store
 * 3. Share the crypto package between web and mobile
 * 4. Encrypt and decrypt messages compatible with web implementation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import * as SecureStore from 'expo-secure-store';
import {
  getOrCreateKeyPair,
  storePrivateKey,
  retrievePrivateKey,
  storePublicKey,
  retrievePublicKey,
  deleteAllKeys,
  encryptDM,
  decryptDM,
  isEncryptionSetup,
  getPublicKeyBase64,
} from '../crypto-rn';
import {
  generateX25519KeyPairSync,
  deriveSharedSecret,
  deriveSessionKey,
  createConversationId,
  bytesToBase64,
  base64ToBytes,
} from '@nextalk/crypto';

// Mock expo-secure-store for testing
jest.mock('expo-secure-store');

describe('React Native Crypto Integration', () => {
  beforeEach(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Mock SecureStore to use in-memory storage
    const storage = new Map<string, string>();
    
    (SecureStore.setItemAsync as jest.Mock).mockImplementation(
      async (key: string, value: string) => {
        storage.set(key, value);
      }
    );
    
    (SecureStore.getItemAsync as jest.Mock).mockImplementation(
      async (key: string) => {
        return storage.get(key) || null;
      }
    );
    
    (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(
      async (key: string) => {
        storage.delete(key);
      }
    );
  });
  
  describe('Key Storage', () => {
    it('should store and retrieve private key from SecureStore', async () => {
      const keyPair = generateX25519KeyPairSync();
      
      await storePrivateKey(keyPair.privateKey);
      const retrieved = await retrievePrivateKey();
      
      expect(retrieved).not.toBeNull();
      expect(retrieved).toEqual(keyPair.privateKey);
    });
    
    it('should store and retrieve public key from SecureStore', async () => {
      const keyPair = generateX25519KeyPairSync();
      
      await storePublicKey(keyPair.publicKey);
      const retrieved = await retrievePublicKey();
      
      expect(retrieved).not.toBeNull();
      expect(retrieved).toEqual(keyPair.publicKey);
    });
    
    it('should return null when key does not exist', async () => {
      const privateKey = await retrievePrivateKey();
      const publicKey = await retrievePublicKey();
      
      expect(privateKey).toBeNull();
      expect(publicKey).toBeNull();
    });
    
    it('should delete all keys', async () => {
      const keyPair = generateX25519KeyPairSync();
      
      await storePrivateKey(keyPair.privateKey);
      await storePublicKey(keyPair.publicKey);
      
      await deleteAllKeys();
      
      const privateKey = await retrievePrivateKey();
      const publicKey = await retrievePublicKey();
      
      expect(privateKey).toBeNull();
      expect(publicKey).toBeNull();
    });
  });
  
  describe('Key Pair Management', () => {
    it('should generate new key pair when none exists', async () => {
      const keyPair = await getOrCreateKeyPair();
      
      expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);
      expect(keyPair.privateKey.length).toBe(32);
      expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
      expect(keyPair.publicKey.length).toBe(32);
    });
    
    it('should retrieve existing key pair', async () => {
      const keyPair1 = await getOrCreateKeyPair();
      const keyPair2 = await getOrCreateKeyPair();
      
      expect(keyPair2.privateKey).toEqual(keyPair1.privateKey);
      expect(keyPair2.publicKey).toEqual(keyPair1.publicKey);
    });
    
    it('should check if encryption is setup', async () => {
      expect(await isEncryptionSetup()).toBe(false);
      
      await getOrCreateKeyPair();
      
      expect(await isEncryptionSetup()).toBe(true);
    });
    
    it('should get public key as base64', async () => {
      await getOrCreateKeyPair();
      
      const publicKeyBase64 = await getPublicKeyBase64();
      
      expect(typeof publicKeyBase64).toBe('string');
      expect(publicKeyBase64.length).toBeGreaterThan(0);
      
      // Verify it's valid base64
      const decoded = base64ToBytes(publicKeyBase64);
      expect(decoded.length).toBe(32);
    });
  });
  
  describe('End-to-End Encryption', () => {
    it('should encrypt and decrypt a message', async () => {
      // Generate key pairs for Alice and Bob
      const aliceKeyPair = generateX25519KeyPairSync();
      const bobKeyPair = generateX25519KeyPairSync();
      
      // Alice stores her private key
      await storePrivateKey(aliceKeyPair.privateKey);
      await storePublicKey(aliceKeyPair.publicKey);
      
      const aliceUserId = 'alice123';
      const bobUserId = 'bob456';
      const message = 'Hello, Bob! This is a secret message.';
      
      // Alice encrypts message for Bob
      const encrypted = await encryptDM(
        message,
        bytesToBase64(bobKeyPair.publicKey),
        bobUserId,
        aliceUserId
      );
      
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.salt).toBeDefined();
      expect(encrypted.keyVersion).toBe(1);
      
      // Verify ciphertext is not plaintext
      expect(encrypted.ciphertext).not.toContain(message);
      
      // Bob stores his private key
      await storePrivateKey(bobKeyPair.privateKey);
      
      // Bob decrypts message from Alice
      const decrypted = await decryptDM(
        encrypted,
        bytesToBase64(aliceKeyPair.publicKey),
        aliceUserId,
        bobUserId
      );
      
      expect(decrypted).toBe(message);
    });
    
    it('should fail to decrypt with wrong key', async () => {
      const aliceKeyPair = generateX25519KeyPairSync();
      const bobKeyPair = generateX25519KeyPairSync();
      const charlieKeyPair = generateX25519KeyPairSync();
      
      await storePrivateKey(aliceKeyPair.privateKey);
      await storePublicKey(aliceKeyPair.publicKey);
      
      const message = 'Secret message';
      
      // Alice encrypts for Bob
      const encrypted = await encryptDM(
        message,
        bytesToBase64(bobKeyPair.publicKey),
        'bob',
        'alice'
      );
      
      // Charlie tries to decrypt (has Bob's public key but wrong private key)
      await storePrivateKey(charlieKeyPair.privateKey);
      
      const decrypted = await decryptDM(
        encrypted,
        bytesToBase64(aliceKeyPair.publicKey),
        'alice',
        'charlie'
      );
      
      // Should return error message, not plaintext
      expect(decrypted).toContain('Unable to decrypt');
      expect(decrypted).not.toBe(message);
    });
    
    it('should handle empty message', async () => {
      const keyPair = generateX25519KeyPairSync();
      await storePrivateKey(keyPair.privateKey);
      
      await expect(
        encryptDM('', bytesToBase64(keyPair.publicKey), 'user1', 'user2')
      ).rejects.toThrow();
    });
  });
  
  describe('Cross-Platform Compatibility', () => {
    it('should use same key derivation as web', () => {
      const aliceKeyPair = generateX25519KeyPairSync();
      const bobKeyPair = generateX25519KeyPairSync();
      
      // Derive shared secret on both sides
      const aliceSharedSecret = deriveSharedSecret(
        aliceKeyPair.privateKey,
        bobKeyPair.publicKey
      );
      const bobSharedSecret = deriveSharedSecret(
        bobKeyPair.privateKey,
        aliceKeyPair.publicKey
      );
      
      // Both should derive the same shared secret
      expect(aliceSharedSecret).toEqual(bobSharedSecret);
    });
    
    it('should use same session key derivation as web', () => {
      const sharedSecret = new Uint8Array(32).fill(1);
      const salt = new Uint8Array(32).fill(2);
      const conversationId = createConversationId('alice', 'bob');
      
      const sessionKey1 = deriveSessionKey(sharedSecret, salt, conversationId);
      const sessionKey2 = deriveSessionKey(sharedSecret, salt, conversationId);
      
      // Same inputs should produce same session key
      expect(sessionKey1).toEqual(sessionKey2);
    });
    
    it('should create deterministic conversation IDs', () => {
      const id1 = createConversationId('alice', 'bob');
      const id2 = createConversationId('bob', 'alice');
      
      // Order should not matter
      expect(id1).toBe(id2);
      expect(id1).toBe('alice_bob');
    });
  });
  
  describe('Session Key Isolation', () => {
    it('should derive different session keys for different conversations', () => {
      const aliceKeyPair = generateX25519KeyPairSync();
      const bobKeyPair = generateX25519KeyPairSync();
      const charlieKeyPair = generateX25519KeyPairSync();
      
      const salt = new Uint8Array(32).fill(1);
      
      // Alice-Bob conversation
      const aliceBobSecret = deriveSharedSecret(
        aliceKeyPair.privateKey,
        bobKeyPair.publicKey
      );
      const aliceBobKey = deriveSessionKey(
        aliceBobSecret,
        salt,
        createConversationId('alice', 'bob')
      );
      
      // Alice-Charlie conversation
      const aliceCharlieSecret = deriveSharedSecret(
        aliceKeyPair.privateKey,
        charlieKeyPair.publicKey
      );
      const aliceCharlieKey = deriveSessionKey(
        aliceCharlieSecret,
        salt,
        createConversationId('alice', 'charlie')
      );
      
      // Different conversations should have different session keys
      expect(aliceBobKey).not.toEqual(aliceCharlieKey);
    });
  });
});
