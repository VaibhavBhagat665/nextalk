/**
 * React Native Crypto Integration
 * 
 * This module integrates the shared @nextalk/crypto package with React Native,
 * replacing Web Crypto API and IndexedDB with React Native equivalents:
 * - Uses @noble/curves for all crypto operations (no Web Crypto API)
 * - Uses expo-secure-store for private key storage (replaces IndexedDB)
 * - Shares the same crypto package between web and mobile
 */

import * as SecureStore from 'expo-secure-store';
import {
  generateX25519KeyPairSync,
  deriveSharedSecret,
  deriveSessionKey,
  generateSalt,
  createConversationId,
  bytesToBase64,
  base64ToBytes,
  KeyPair,
  EncryptedMessage,
  CryptoError,
  CryptoErrorCode,
} from '@nextalk/crypto';
import { encryptMessageRN, decryptMessageRN } from './encryption-rn';

/**
 * Storage keys for expo-secure-store
 */
const STORAGE_KEYS = {
  PRIVATE_KEY: 'nextalk_x25519_private_key',
  PUBLIC_KEY: 'nextalk_x25519_public_key',
  KEY_VERSION: 'nextalk_x25519_key_version',
};

/**
 * Store private key securely using expo-secure-store
 * 
 * The private key is stored in the device's secure enclave (iOS Keychain or
 * Android Keystore) and never leaves the device.
 * 
 * @param privateKey - The 32-byte private key to store
 * @throws {CryptoError} If storage fails
 */
export async function storePrivateKey(privateKey: Uint8Array): Promise<void> {
  try {
    const base64Key = bytesToBase64(privateKey);
    await SecureStore.setItemAsync(STORAGE_KEYS.PRIVATE_KEY, base64Key);
  } catch (error) {
    throw new CryptoError(
      CryptoErrorCode.KEY_STORAGE_FAILED,
      'Failed to store private key in SecureStore',
      error
    );
  }
}

/**
 * Retrieve private key from expo-secure-store
 * 
 * @returns The private key or null if not found
 * @throws {CryptoError} If retrieval fails
 */
export async function retrievePrivateKey(): Promise<Uint8Array | null> {
  try {
    const base64Key = await SecureStore.getItemAsync(STORAGE_KEYS.PRIVATE_KEY);
    if (!base64Key) {
      return null;
    }
    return base64ToBytes(base64Key);
  } catch (error) {
    throw new CryptoError(
      CryptoErrorCode.KEY_RETRIEVAL_FAILED,
      'Failed to retrieve private key from SecureStore',
      error
    );
  }
}

/**
 * Store public key in SecureStore for caching
 * 
 * Public keys don't need the same level of security as private keys,
 * but we store them in SecureStore for consistency.
 * 
 * @param publicKey - The 32-byte public key to store
 */
export async function storePublicKey(publicKey: Uint8Array): Promise<void> {
  try {
    const base64Key = bytesToBase64(publicKey);
    await SecureStore.setItemAsync(STORAGE_KEYS.PUBLIC_KEY, base64Key);
  } catch (error) {
    throw new CryptoError(
      CryptoErrorCode.KEY_STORAGE_FAILED,
      'Failed to store public key in SecureStore',
      error
    );
  }
}

/**
 * Retrieve public key from SecureStore
 * 
 * @returns The public key or null if not found
 */
export async function retrievePublicKey(): Promise<Uint8Array | null> {
  try {
    const base64Key = await SecureStore.getItemAsync(STORAGE_KEYS.PUBLIC_KEY);
    if (!base64Key) {
      return null;
    }
    return base64ToBytes(base64Key);
  } catch (error) {
    throw new CryptoError(
      CryptoErrorCode.KEY_RETRIEVAL_FAILED,
      'Failed to retrieve public key from SecureStore',
      error
    );
  }
}

/**
 * Delete all stored keys from SecureStore
 * 
 * Used when user logs out or wants to reset encryption
 */
export async function deleteAllKeys(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.PRIVATE_KEY);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.PUBLIC_KEY);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.KEY_VERSION);
  } catch (error) {
    console.warn('Failed to delete some keys from SecureStore:', error);
  }
}

/**
 * Generate or retrieve X25519 key pair
 * 
 * If a key pair already exists in SecureStore, it will be retrieved.
 * Otherwise, a new key pair is generated and stored.
 * 
 * This is the main entry point for initializing E2E encryption on mobile.
 * 
 * @returns The user's X25519 key pair
 * @throws {CryptoError} If key generation or storage fails
 */
export async function getOrCreateKeyPair(): Promise<KeyPair> {
  try {
    // Try to retrieve existing keys
    const privateKey = await retrievePrivateKey();
    const publicKey = await retrievePublicKey();
    
    if (privateKey && publicKey) {
      return { privateKey, publicKey };
    }
    
    // Generate new key pair using @noble/curves (sync, no Web Crypto)
    const keyPair = generateX25519KeyPairSync();
    
    // Store keys securely
    await storePrivateKey(keyPair.privateKey);
    await storePublicKey(keyPair.publicKey);
    
    return keyPair;
  } catch (error) {
    if (error instanceof CryptoError) {
      throw error;
    }
    throw new CryptoError(
      CryptoErrorCode.KEY_GENERATION_FAILED,
      'Failed to get or create key pair',
      error
    );
  }
}

/**
 * Encrypt a direct message for a specific recipient
 * 
 * This is the main encryption function for mobile DMs. It:
 * 1. Retrieves your private key from SecureStore
 * 2. Performs ECDH with recipient's public key to get shared secret
 * 3. Derives session key using HKDF
 * 4. Encrypts the message using AES-256-GCM
 * 
 * @param plaintext - The message to encrypt
 * @param recipientPublicKey - The recipient's X25519 public key (base64)
 * @param recipientUserId - The recipient's user ID
 * @param myUserId - Your user ID
 * @param keyVersion - Session key version (default: 1)
 * @returns Encrypted message ready to send to server
 * @throws {CryptoError} If encryption fails
 */
export async function encryptDM(
  plaintext: string,
  recipientPublicKey: string,
  recipientUserId: string,
  myUserId: string,
  keyVersion: number = 1
): Promise<EncryptedMessage> {
  try {
    // Retrieve private key
    const privateKey = await retrievePrivateKey();
    if (!privateKey) {
      throw new CryptoError(
        CryptoErrorCode.KEY_RETRIEVAL_FAILED,
        'Private key not found. Please generate a key pair first.'
      );
    }
    
    // Decode recipient's public key
    const recipientPubKey = base64ToBytes(recipientPublicKey);
    
    // Perform ECDH to get shared secret
    const sharedSecret = deriveSharedSecret(privateKey, recipientPubKey);
    
    // Generate salt and derive session key
    const salt = generateSalt(32);
    const conversationId = createConversationId(myUserId, recipientUserId);
    const sessionKey = deriveSessionKey(sharedSecret, salt, conversationId);
    
    // Encrypt message
    const encrypted = await encryptMessageRN(plaintext, sessionKey, salt, keyVersion);
    
    return encrypted;
  } catch (error) {
    if (error instanceof CryptoError) {
      throw error;
    }
    throw new CryptoError(
      CryptoErrorCode.ENCRYPTION_FAILED,
      'Failed to encrypt DM',
      error
    );
  }
}

/**
 * Decrypt a direct message from a specific sender
 * 
 * This is the main decryption function for mobile DMs. It:
 * 1. Retrieves your private key from SecureStore
 * 2. Performs ECDH with sender's public key to get shared secret
 * 3. Derives session key using HKDF with the provided salt
 * 4. Decrypts the message using AES-256-GCM
 * 
 * @param encrypted - The encrypted message
 * @param senderPublicKey - The sender's X25519 public key (base64)
 * @param senderUserId - The sender's user ID
 * @param myUserId - Your user ID
 * @returns Decrypted plaintext or "[Unable to decrypt message]" on failure
 * @throws {CryptoError} If decryption setup fails
 */
export async function decryptDM(
  encrypted: EncryptedMessage,
  senderPublicKey: string,
  senderUserId: string,
  myUserId: string
): Promise<string> {
  try {
    // Retrieve private key
    const privateKey = await retrievePrivateKey();
    if (!privateKey) {
      throw new CryptoError(
        CryptoErrorCode.KEY_RETRIEVAL_FAILED,
        'Private key not found. Cannot decrypt message.'
      );
    }
    
    // Decode sender's public key
    const senderPubKey = base64ToBytes(senderPublicKey);
    
    // Perform ECDH to get shared secret
    const sharedSecret = deriveSharedSecret(privateKey, senderPubKey);
    
    // Derive session key using salt from encrypted message
    const salt = base64ToBytes(encrypted.salt);
    const conversationId = createConversationId(myUserId, senderUserId);
    const sessionKey = deriveSessionKey(sharedSecret, salt, conversationId);
    
    // Decrypt message
    const plaintext = await decryptMessageRN(encrypted, sessionKey, encrypted.keyVersion);
    
    return plaintext;
  } catch (error) {
    if (error instanceof CryptoError) {
      // For retrieval errors, throw
      if (error.code === CryptoErrorCode.KEY_RETRIEVAL_FAILED) {
        throw error;
      }
    }
    
    // For decryption failures, return placeholder
    console.warn('Failed to decrypt DM:', error);
    return '[Unable to decrypt message]';
  }
}

/**
 * Check if encryption is set up for the current user
 * 
 * @returns True if a key pair exists
 */
export async function isEncryptionSetup(): Promise<boolean> {
  try {
    const privateKey = await retrievePrivateKey();
    return privateKey !== null;
  } catch {
    return false;
  }
}

/**
 * Get the user's public key for sharing with other users
 * 
 * @returns Base64-encoded public key
 * @throws {CryptoError} If key not found
 */
export async function getPublicKeyBase64(): Promise<string> {
  const publicKey = await retrievePublicKey();
  if (!publicKey) {
    throw new CryptoError(
      CryptoErrorCode.KEY_RETRIEVAL_FAILED,
      'Public key not found. Please generate a key pair first.'
    );
  }
  return bytesToBase64(publicKey);
}

/**
 * Re-export commonly used utilities from the shared crypto package
 */
export {
  type KeyPair,
  type EncryptedMessage,
  type CryptoError,
  CryptoErrorCode,
  bytesToBase64,
  base64ToBytes,
  generateFingerprint,
} from '@nextalk/crypto';
