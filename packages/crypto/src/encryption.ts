/**
 * AES-256-GCM encryption and decryption utilities
 * 
 * Note: This module provides a platform-agnostic interface.
 * Actual encryption must be implemented using Web Crypto API (browser)
 * or other platform-specific implementations.
 */

import { randomBytes } from '@noble/hashes/utils';
import { EncryptedMessage, CryptoError, CryptoErrorCode } from './types.js';
import { bytesToBase64, base64ToBytes } from './utils.js';

/**
 * Encrypt a message using AES-256-GCM
 * 
 * Uses Web Crypto API for browser-native encryption. The function:
 * 1. Generates a random 96-bit (12-byte) IV for GCM mode
 * 2. Encrypts the plaintext with AES-256-GCM
 * 3. Returns ciphertext, IV, salt, and key version as base64-encoded strings
 * 
 * @param plaintext - The message to encrypt
 * @param sessionKey - The 32-byte AES-256 key
 * @param salt - Salt used for key derivation (for metadata)
 * @param keyVersion - Version of the session key used
 * @returns Encrypted message with IV, salt, and key version
 * @throws {CryptoError} If encryption fails
 * 
 * @example
 * ```typescript
 * const encrypted = await encryptMessage(
 *   "Hello, world!",
 *   sessionKey,
 *   salt,
 *   1
 * );
 * ```
 */
export async function encryptMessage(
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
    const iv = generateIV();
    
    // Import session key for Web Crypto API
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      sessionKey as any,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    // Encode plaintext to bytes
    const encoder = new TextEncoder();
    const plaintextBytes = encoder.encode(plaintext);
    
    // Encrypt with AES-256-GCM
    const ciphertextBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv as any,
        // Authentication tag length is 128 bits by default
      },
      cryptoKey,
      plaintextBytes
    );
    
    // Convert to base64 for transmission
    const ciphertext = bytesToBase64(new Uint8Array(ciphertextBuffer));
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
 * Decrypt a message using AES-256-GCM
 * 
 * Uses Web Crypto API for browser-native decryption. The function:
 * 1. Validates the key version matches expected version
 * 2. Decodes base64-encoded ciphertext and IV
 * 3. Imports the session key for Web Crypto API
 * 4. Decrypts the ciphertext with AES-256-GCM
 * 5. Returns the plaintext, or "[Unable to decrypt]" on failure
 * 
 * Gracefully handles decryption failures (wrong key, corrupted data, etc.)
 * by returning a placeholder message instead of throwing an error.
 * 
 * @param encrypted - The encrypted message
 * @param sessionKey - The 32-byte AES-256 key
 * @param expectedKeyVersion - Optional key version to validate against
 * @returns Decrypted plaintext or error message
 * @throws {CryptoError} Only for invalid inputs, not decryption failures
 * 
 * @example
 * ```typescript
 * const plaintext = await decryptMessage(encrypted, sessionKey, 1);
 * // On success: "Hello, world!"
 * // On failure: "[Unable to decrypt message]"
 * ```
 */
export async function decryptMessage(
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
      // Return placeholder instead of throwing - wrong key version
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
    
    // Import session key for Web Crypto API
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      sessionKey as any,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    // Decrypt with AES-256-GCM
    const plaintextBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as any,
      },
      cryptoKey,
      ciphertextBytes as any
    );
    
    // Decode bytes to string
    const decoder = new TextDecoder();
    const plaintext = decoder.decode(plaintextBuffer);
    
    return plaintext;
  } catch (error) {
    // Handle decryption failures gracefully
    // This can happen if:
    // - Wrong key is used
    // - Ciphertext is corrupted
    // - Authentication tag verification fails
    
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
    // This matches the design requirement to handle failures gracefully
    return '[Unable to decrypt message]';
  }
}

/**
 * Generate a random initialization vector for AES-GCM
 * 
 * AES-GCM requires a 96-bit (12-byte) IV for optimal performance.
 * Each encryption operation must use a unique IV.
 * 
 * @returns Random 12-byte IV
 */
export function generateIV(): Uint8Array {
  return randomBytes(12); // 96 bits for GCM
}
