/**
 * React Native AES-256-GCM Encryption
 * 
 * This module provides AES-256-GCM encryption/decryption for React Native
 * using @noble/ciphers instead of Web Crypto API.
 */

import { gcm } from '@noble/ciphers/aes';
import { randomBytes } from '@noble/ciphers/webcrypto';
import {
  bytesToBase64,
  base64ToBytes,
  EncryptedMessage,
  CryptoError,
  CryptoErrorCode,
} from '@nextalk/crypto';

/**
 * Encrypt a message using AES-256-GCM (React Native compatible)
 * 
 * Uses @noble/ciphers for pure JavaScript AES-256-GCM implementation.
 * 
 * @param plaintext - The message to encrypt
 * @param sessionKey - The 32-byte AES-256 key
 * @param salt - Salt used for key derivation (for metadata)
 * @param keyVersion - Version of the session key used
 * @returns Encrypted message with IV, salt, and key version
 * @throws {CryptoError} If encryption fails
 */
export async function encryptMessageRN(
  plaintext: string,
  sessionKey: Uint8Array,
  salt: Uint8Array,
  keyVersion: number
): Promise<EncryptedMessage> {
  try {
    // Validate inputs
    if (!plaintext) {
      throw new CryptoError(
        CryptoErrorCode.ENCRYPTION_FAILED,
        'Plaintext cannot be empty'
      );
    }
    
    if (sessionKey.length !== 32) {
      throw new CryptoError(
        CryptoErrorCode.INVALID_KEY,
        'Session key must be 32 bytes for AES-256'
      );
    }
    
    if (!Number.isInteger(keyVersion) || keyVersion < 1) {
      throw new CryptoError(
        CryptoErrorCode.ENCRYPTION_FAILED,
        'Key version must be a positive integer'
      );
    }
    
    // Generate random 96-bit IV (optimal for GCM)
    const iv = randomBytes(12);
    
    // Encode plaintext to bytes
    const encoder = new TextEncoder();
    const plaintextBytes = encoder.encode(plaintext);
    
    // Encrypt with AES-256-GCM using @noble/ciphers
    const aesGcm = gcm(sessionKey, iv);
    const ciphertextBytes = aesGcm.encrypt(plaintextBytes);
    
    // Convert to base64 for transmission
    const ciphertext = bytesToBase64(ciphertextBytes);
    const ivBase64 = bytesToBase64(iv);
    const saltBase64 = bytesToBase64(salt);
    
    return {
      ciphertext,
      iv: ivBase64,
      salt: saltBase64,
      keyVersion,
    };
  } catch (error) {
    if (error instanceof CryptoError) {
      throw error;
    }
    throw new CryptoError(
      CryptoErrorCode.ENCRYPTION_FAILED,
      'Failed to encrypt message',
      error
    );
  }
}

/**
 * Decrypt a message using AES-256-GCM (React Native compatible)
 * 
 * Uses @noble/ciphers for pure JavaScript AES-256-GCM implementation.
 * 
 * @param encrypted - The encrypted message
 * @param sessionKey - The 32-byte AES-256 key
 * @param expectedKeyVersion - Optional key version to validate against
 * @returns Decrypted plaintext or error message
 * @throws {CryptoError} Only for invalid inputs, not decryption failures
 */
export async function decryptMessageRN(
  encrypted: EncryptedMessage,
  sessionKey: Uint8Array,
  expectedKeyVersion?: number
): Promise<string> {
  try {
    // Validate inputs
    if (!encrypted.ciphertext || !encrypted.iv) {
      throw new CryptoError(
        CryptoErrorCode.INVALID_CIPHERTEXT,
        'Encrypted message must have ciphertext and IV'
      );
    }
    
    if (!encrypted.keyVersion || !Number.isInteger(encrypted.keyVersion)) {
      throw new CryptoError(
        CryptoErrorCode.INVALID_CIPHERTEXT,
        'Encrypted message must have valid key version'
      );
    }
    
    // Validate key version if provided
    if (expectedKeyVersion !== undefined && encrypted.keyVersion !== expectedKeyVersion) {
      console.warn(
        `Key version mismatch: expected ${expectedKeyVersion}, got ${encrypted.keyVersion}`
      );
      return '[Unable to decrypt message - key version mismatch]';
    }
    
    if (sessionKey.length !== 32) {
      throw new CryptoError(
        CryptoErrorCode.INVALID_KEY,
        'Session key must be 32 bytes for AES-256'
      );
    }
    
    // Decode base64 inputs
    const ciphertextBytes = base64ToBytes(encrypted.ciphertext);
    const iv = base64ToBytes(encrypted.iv);
    
    // Validate IV length (must be 12 bytes for GCM)
    if (iv.length !== 12) {
      throw new CryptoError(
        CryptoErrorCode.INVALID_CIPHERTEXT,
        'IV must be 12 bytes for AES-GCM'
      );
    }
    
    // Decrypt with AES-256-GCM using @noble/ciphers
    const aesGcm = gcm(sessionKey, iv);
    const plaintextBytes = aesGcm.decrypt(ciphertextBytes);
    
    // Decode bytes to string
    const decoder = new TextDecoder();
    const plaintext = decoder.decode(plaintextBytes);
    
    return plaintext;
  } catch (error) {
    // Handle decryption failures gracefully
    if (error instanceof CryptoError) {
      // Re-throw validation errors (invalid inputs)
      if (
        error.code === CryptoErrorCode.INVALID_KEY ||
        error.code === CryptoErrorCode.INVALID_CIPHERTEXT
      ) {
        throw error;
      }
    }
    
    // For actual decryption failures, return placeholder
    console.warn('Decryption failed:', error);
    return '[Unable to decrypt message]';
  }
}
