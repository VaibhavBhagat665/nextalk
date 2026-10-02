/**
 * API client for uploading and retrieving public keys from the server
 * 
 * This module provides functions to interact with the server API
 * for storing and retrieving X25519 public keys.
 */

import { bytesToBase64, base64ToBytes } from './utils.js';
import { CryptoError, CryptoErrorCode } from './types.js';

/**
 * Upload a public key to the server
 * 
 * Stores the X25519 public key in the UserSettings table so other users
 * can retrieve it for key exchange.
 * 
 * @param publicKey - The 32-byte X25519 public key
 * @param apiUrl - Base URL for the API (defaults to empty string for same-origin)
 * @throws {CryptoError} If upload fails
 * 
 * @example
 * ```typescript
 * await uploadPublicKey(keyPair.publicKey);
 * ```
 */
export async function uploadPublicKey(
  publicKey: Uint8Array,
  apiUrl: string = ''
): Promise<void> {
  if (publicKey.length !== 32) {
    throw new CryptoError(
      CryptoErrorCode.INVALID_KEY,
      `Public key must be 32 bytes, got ${publicKey.length}`
    );
  }

  try {
    const publicKeyBase64 = bytesToBase64(publicKey);

    const response = await fetch(`${apiUrl}/api/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publicKey: publicKeyBase64,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as any;
      throw new Error(
        error.message || `HTTP ${response.status}: ${response.statusText}`
      );
    }
  } catch (error) {
    throw new CryptoError(
      CryptoErrorCode.KEY_STORAGE_FAILED,
      'Failed to upload public key to server',
      error
    );
  }
}

/**
 * Retrieve a public key from the server
 * 
 * Fetches the X25519 public key for another user from the UserSettings table.
 * This key is needed to perform ECDH key exchange for encrypted DMs.
 * 
 * @param userId - The internal user ID (not Clerk ID)
 * @param apiUrl - Base URL for the API (defaults to empty string for same-origin)
 * @returns The 32-byte public key, or null if not found
 * @throws {CryptoError} If retrieval fails (not including "not found")
 * 
 * @example
 * ```typescript
 * const theirPublicKey = await retrievePublicKey('user456');
 * if (!theirPublicKey) {
 *   console.log('User has not set up E2E encryption');
 * }
 * ```
 */
export async function retrievePublicKey(
  userId: string,
  apiUrl: string = ''
): Promise<Uint8Array | null> {
  if (!userId) {
    throw new CryptoError(
      CryptoErrorCode.INVALID_KEY,
      'User ID cannot be empty'
    );
  }

  try {
    const response = await fetch(`${apiUrl}/api/users/${userId}/key`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 404) {
      // User not found or no public key set
      return null;
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as any;
      throw new Error(
        error.message || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json() as any;
    
    if (!data.publicKey) {
      return null;
    }

    // Decode from base64
    const publicKey = base64ToBytes(data.publicKey);
    
    // Validate key length
    if (publicKey.length !== 32) {
      throw new Error(
        `Invalid public key length: expected 32 bytes, got ${publicKey.length}`
      );
    }

    return publicKey;
  } catch (error) {
    if (error instanceof CryptoError) {
      throw error;
    }
    throw new CryptoError(
      CryptoErrorCode.KEY_RETRIEVAL_FAILED,
      'Failed to retrieve public key from server',
      error
    );
  }
}

/**
 * Get the current user's public key from the server
 * 
 * Retrieves the authenticated user's own public key from the server.
 * This is useful for verifying that the key was uploaded correctly.
 * 
 * @param apiUrl - Base URL for the API (defaults to empty string for same-origin)
 * @returns The 32-byte public key, or null if not found
 * @throws {CryptoError} If retrieval fails
 * 
 * @example
 * ```typescript
 * const myPublicKey = await getMyPublicKey();
 * ```
 */
export async function getMyPublicKey(
  apiUrl: string = ''
): Promise<Uint8Array | null> {
  try {
    const response = await fetch(`${apiUrl}/api/settings`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as any;
      throw new Error(
        error.message || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json() as any;
    
    if (!data.publicKey) {
      return null;
    }

    // Decode from base64
    const publicKey = base64ToBytes(data.publicKey);
    
    // Validate key length
    if (publicKey.length !== 32) {
      throw new Error(
        `Invalid public key length: expected 32 bytes, got ${publicKey.length}`
      );
    }

    return publicKey;
  } catch (error) {
    if (error instanceof CryptoError) {
      throw error;
    }
    throw new CryptoError(
      CryptoErrorCode.KEY_RETRIEVAL_FAILED,
      'Failed to retrieve own public key from server',
      error
    );
  }
}
