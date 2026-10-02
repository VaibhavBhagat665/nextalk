/**
 * ECDH key exchange and HKDF key derivation utilities
 */

import { x25519 } from '@noble/curves/ed25519';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/hashes/utils';
import { CryptoError, CryptoErrorCode } from './types.js';
import { validateKey } from './key-generation.js';

/**
 * Derive a shared secret using X25519 ECDH
 * 
 * Both parties perform ECDH with their own private key and the other party's
 * public key to arrive at the same shared secret:
 * - Alice: sharedSecret = ECDH(alice.privateKey, bob.publicKey)
 * - Bob: sharedSecret = ECDH(bob.privateKey, alice.publicKey)
 * - Result: Both get the same sharedSecret
 * 
 * @param myPrivateKey - Your private key (32 bytes)
 * @param theirPublicKey - Their public key (32 bytes)
 * @returns The shared secret (32 bytes)
 * @throws {CryptoError} If key exchange fails
 * 
 * @example
 * ```typescript
 * const sharedSecret = deriveSharedSecret(
 *   myKeyPair.privateKey,
 *   theirPublicKey
 * );
 * ```
 */
export function deriveSharedSecret(
  myPrivateKey: Uint8Array,
  theirPublicKey: Uint8Array
): Uint8Array {
  try {
    validateKey(myPrivateKey, 'Private key');
    validateKey(theirPublicKey, 'Public key');
    
    // Perform X25519 ECDH
    const sharedSecret = x25519.getSharedSecret(myPrivateKey, theirPublicKey);
    
    return sharedSecret;
  } catch (error) {
    if (error instanceof CryptoError) {
      throw error;
    }
    throw new CryptoError(
      CryptoErrorCode.KEY_DERIVATION_FAILED,
      'Failed to derive shared secret via ECDH',
      error
    );
  }
}

/**
 * Derive an AES-256 session key from a shared secret using HKDF
 * 
 * HKDF (HMAC-based Key Derivation Function) expands the shared secret into
 * a cryptographically strong session key suitable for AES-256-GCM encryption.
 * 
 * The conversation ID is included in the info parameter to ensure different
 * conversations derive different keys from the same shared secret.
 * 
 * @param sharedSecret - The shared secret from ECDH (32 bytes)
 * @param salt - Random salt for key derivation (32 bytes recommended)
 * @param conversationId - Unique conversation identifier
 * @returns Derived AES-256 key (32 bytes)
 * @throws {CryptoError} If key derivation fails
 * 
 * @example
 * ```typescript
 * const salt = generateSalt();
 * const sessionKey = deriveSessionKey(
 *   sharedSecret,
 *   salt,
 *   'user1_user2'
 * );
 * ```
 */
export function deriveSessionKey(
  sharedSecret: Uint8Array,
  salt: Uint8Array,
  conversationId: string
): Uint8Array {
  try {
    validateKey(sharedSecret, 'Shared secret');
    
    if (!(salt instanceof Uint8Array) || salt.length < 16) {
      throw new CryptoError(
        CryptoErrorCode.KEY_DERIVATION_FAILED,
        'Salt must be at least 16 bytes'
      );
    }
    
    // HKDF parameters
    const info = new TextEncoder().encode(`nextalk-session-${conversationId}`);
    const keyLength = 32; // 256 bits for AES-256
    
    // Derive key using HKDF-SHA-256
    const derivedKey = hkdf(sha256, sharedSecret, salt, info, keyLength);
    
    return derivedKey;
  } catch (error) {
    if (error instanceof CryptoError) {
      throw error;
    }
    throw new CryptoError(
      CryptoErrorCode.KEY_DERIVATION_FAILED,
      'Failed to derive session key via HKDF',
      error
    );
  }
}

/**
 * Generate a random salt for key derivation
 * 
 * @param length - Length of salt in bytes (default: 32)
 * @returns Random salt
 */
export function generateSalt(length: number = 32): Uint8Array {
  return randomBytes(length);
}

/**
 * Generate a conversation ID from two user IDs
 * 
 * Creates a deterministic conversation ID by sorting user IDs alphabetically.
 * This ensures both parties derive the same conversation ID.
 * 
 * @param userId1 - First user ID
 * @param userId2 - Second user ID
 * @returns Conversation ID (e.g., "user1_user2")
 * 
 * @example
 * ```typescript
 * const conversationId = createConversationId("alice", "bob");
 * // Result: "alice_bob"
 * ```
 */
export function createConversationId(userId1: string, userId2: string): string {
  const sortedIds = [userId1, userId2].sort();
  return sortedIds.join('_');
}
