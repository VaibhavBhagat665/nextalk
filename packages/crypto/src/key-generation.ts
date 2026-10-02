/**
 * X25519 key generation utilities
 */

import { x25519 } from '@noble/curves/ed25519';
import { randomBytes } from '@noble/hashes/utils';
import { KeyPair, CryptoError, CryptoErrorCode } from './types.js';

/**
 * Feature detection: Check if Web Crypto API supports X25519
 * 
 * Web Crypto API support for X25519 was added in:
 * - Chrome/Edge 111+ (March 2023)
 * - Firefox 111+ (March 2023)
 * - Safari 16.4+ (March 2023)
 * 
 * @returns True if Web Crypto API supports X25519
 */
export function isWebCryptoX25519Supported(): boolean {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return false;
  }
  
  // Check if generateKey exists and supports X25519
  try {
    // We can't directly test X25519 support without generating a key,
    // so we check for the existence of the necessary APIs
    return (
      typeof crypto.subtle.generateKey === 'function' &&
      typeof crypto.subtle.exportKey === 'function'
    );
  } catch {
    return false;
  }
}

/**
 * Generate X25519 key pair using Web Crypto API
 * 
 * Uses the browser's native implementation for better performance and security.
 * Falls back to @noble/curves if not supported.
 * 
 * @returns A promise that resolves to an X25519 key pair
 * @throws {CryptoError} If key generation fails
 */
async function generateX25519KeyPairWebCrypto(): Promise<KeyPair> {
  try {
    // Generate key pair using Web Crypto API
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'X25519',
      } as any, // TypeScript doesn't have X25519 types yet
      true, // extractable
      ['deriveBits']
    );
    
    // Export keys to raw format (32 bytes each)
    const publicKeyBuffer = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    
    // For X25519, the private key in PKCS#8 format has a 48-byte header
    // The actual 32-byte key is at the end
    const privateKeyView = new Uint8Array(privateKeyBuffer);
    const privateKey = privateKeyView.slice(-32);
    
    return {
      publicKey: new Uint8Array(publicKeyBuffer),
      privateKey: privateKey,
    };
  } catch (error) {
    throw new CryptoError(
      CryptoErrorCode.KEY_GENERATION_FAILED,
      'Failed to generate X25519 key pair using Web Crypto API',
      error
    );
  }
}

/**
 * Generate X25519 key pair using @noble/curves fallback
 * 
 * Uses the pure JavaScript implementation as a fallback when
 * Web Crypto API doesn't support X25519.
 * 
 * @returns An X25519 key pair
 * @throws {CryptoError} If key generation fails
 */
function generateX25519KeyPairNoble(): KeyPair {
  try {
    // Generate 32 random bytes for the private key
    const privateKey = randomBytes(32);
    
    // Derive the public key from the private key using X25519
    const publicKey = x25519.getPublicKey(privateKey);
    
    return {
      publicKey,
      privateKey,
    };
  } catch (error) {
    throw new CryptoError(
      CryptoErrorCode.KEY_GENERATION_FAILED,
      'Failed to generate X25519 key pair using @noble/curves',
      error
    );
  }
}

/**
 * Generate a new X25519 key pair for ECDH key exchange
 * 
 * Automatically detects browser support and uses:
 * 1. Web Crypto API (if supported) - native implementation, better performance
 * 2. @noble/curves (fallback) - pure JavaScript, works everywhere
 * 
 * The private key must be stored securely (IndexedDB on web, SecureStore on mobile)
 * and never transmitted. The public key can be shared with other users.
 * 
 * @returns A new X25519 key pair (Promise if Web Crypto, sync if @noble/curves)
 * @throws {CryptoError} If key generation fails
 * 
 * @example
 * ```typescript
 * const keyPair = await generateX25519KeyPair();
 * // Store privateKey securely, upload publicKey to server
 * ```
 */
export async function generateX25519KeyPair(): Promise<KeyPair> {
  // Feature detection: Try Web Crypto API first
  if (isWebCryptoX25519Supported()) {
    try {
      return await generateX25519KeyPairWebCrypto();
    } catch (error) {
      // If Web Crypto fails, fall back to @noble/curves
      console.warn('Web Crypto X25519 failed, falling back to @noble/curves', error);
      return generateX25519KeyPairNoble();
    }
  }
  
  // Use @noble/curves as fallback
  return generateX25519KeyPairNoble();
}

/**
 * Synchronous version of generateX25519KeyPair using @noble/curves only
 * 
 * Useful when you need synchronous key generation or in environments
 * without Web Crypto API support (like React Native).
 * 
 * @returns A new X25519 key pair
 * @throws {CryptoError} If key generation fails
 * 
 * @example
 * ```typescript
 * const keyPair = generateX25519KeyPairSync();
 * // Store privateKey securely, upload publicKey to server
 * ```
 */
export function generateX25519KeyPairSync(): KeyPair {
  return generateX25519KeyPairNoble();
}

/**
 * Validate that a key is a valid 32-byte Uint8Array
 * 
 * @param key - The key to validate
 * @param keyName - Name of the key for error messages
 * @throws {CryptoError} If the key is invalid
 */
export function validateKey(key: Uint8Array, keyName: string): void {
  if (!(key instanceof Uint8Array)) {
    throw new CryptoError(
      CryptoErrorCode.INVALID_KEY,
      `${keyName} must be a Uint8Array`
    );
  }
  
  if (key.length !== 32) {
    throw new CryptoError(
      CryptoErrorCode.INVALID_KEY,
      `${keyName} must be exactly 32 bytes, got ${key.length} bytes`
    );
  }
}
