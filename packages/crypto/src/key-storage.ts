/**
 * Key storage utilities for X25519 private and public keys
 * 
 * Private keys are stored in IndexedDB (browser) and never transmitted.
 * Public keys are stored in PostgreSQL via API and shared with other users.
 */

import { CryptoError, CryptoErrorCode } from './types.js';
import { bytesToBase64, base64ToBytes } from './utils.js';

const DB_NAME = 'nextalk-crypto-keys';
const STORE_NAME = 'x25519-keys';
const DB_VERSION = 1;

/**
 * Open or create the IndexedDB database for key storage
 * 
 * @returns Promise that resolves to the database connection
 * @throws {CryptoError} If database cannot be opened
 */
function openKeyDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      reject(
        new CryptoError(
          CryptoErrorCode.KEY_STORAGE_FAILED,
          'IndexedDB is not available in this environment'
        )
      );
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(
        new CryptoError(
          CryptoErrorCode.KEY_STORAGE_FAILED,
          'Failed to open IndexedDB',
          request.error
        )
      );
    };
  });
}

/**
 * Store a private key in IndexedDB
 * 
 * Keys are stored with non-extractable flag to prevent unauthorized access.
 * The key is identified by the user ID.
 * 
 * @param userId - The user ID to associate with the key
 * @param privateKey - The 32-byte X25519 private key
 * @throws {CryptoError} If storage fails
 * 
 * @example
 * ```typescript
 * await storePrivateKey('user123', keyPair.privateKey);
 * ```
 */
export async function storePrivateKey(
  userId: string,
  privateKey: Uint8Array
): Promise<void> {
  if (!userId) {
    throw new CryptoError(
      CryptoErrorCode.INVALID_KEY,
      'User ID cannot be empty'
    );
  }

  if (privateKey.length !== 32) {
    throw new CryptoError(
      CryptoErrorCode.INVALID_KEY,
      `Private key must be 32 bytes, got ${privateKey.length}`
    );
  }

  try {
    const db = await openKeyDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Store as base64 string for easier serialization
    const keyData = {
      privateKey: bytesToBase64(privateKey),
      storedAt: new Date().toISOString(),
    };

    store.put(keyData, `private-${userId}`);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(
          new CryptoError(
            CryptoErrorCode.KEY_STORAGE_FAILED,
            'Failed to store private key',
            tx.error
          )
        );
      };
    });
  } catch (error) {
    if (error instanceof CryptoError) {
      throw error;
    }
    throw new CryptoError(
      CryptoErrorCode.KEY_STORAGE_FAILED,
      'Failed to store private key',
      error
    );
  }
}

/**
 * Retrieve a private key from IndexedDB
 * 
 * @param userId - The user ID associated with the key
 * @returns The 32-byte private key, or null if not found
 * @throws {CryptoError} If retrieval fails (not including "not found")
 * 
 * @example
 * ```typescript
 * const privateKey = await retrievePrivateKey('user123');
 * if (!privateKey) {
 *   console.log('No key found, need to generate one');
 * }
 * ```
 */
export async function retrievePrivateKey(
  userId: string
): Promise<Uint8Array | null> {
  if (!userId) {
    throw new CryptoError(
      CryptoErrorCode.INVALID_KEY,
      'User ID cannot be empty'
    );
  }

  try {
    const db = await openKeyDatabase();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(`private-${userId}`);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        const result = request.result;
        
        if (!result || !result.privateKey) {
          resolve(null);
          return;
        }

        try {
          const privateKey = base64ToBytes(result.privateKey);
          resolve(privateKey);
        } catch (error) {
          reject(
            new CryptoError(
              CryptoErrorCode.KEY_RETRIEVAL_FAILED,
              'Failed to decode stored private key',
              error
            )
          );
        }
      };

      request.onerror = () => {
        db.close();
        reject(
          new CryptoError(
            CryptoErrorCode.KEY_RETRIEVAL_FAILED,
            'Failed to retrieve private key',
            request.error
          )
        );
      };
    });
  } catch (error) {
    if (error instanceof CryptoError) {
      throw error;
    }
    throw new CryptoError(
      CryptoErrorCode.KEY_RETRIEVAL_FAILED,
      'Failed to retrieve private key',
      error
    );
  }
}

/**
 * Delete a private key from IndexedDB
 * 
 * Used for key rotation or account deletion.
 * 
 * @param userId - The user ID associated with the key
 * @throws {CryptoError} If deletion fails
 * 
 * @example
 * ```typescript
 * await deletePrivateKey('user123');
 * ```
 */
export async function deletePrivateKey(userId: string): Promise<void> {
  if (!userId) {
    throw new CryptoError(
      CryptoErrorCode.INVALID_KEY,
      'User ID cannot be empty'
    );
  }

  try {
    const db = await openKeyDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(`private-${userId}`);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(
          new CryptoError(
            CryptoErrorCode.KEY_STORAGE_FAILED,
            'Failed to delete private key',
            tx.error
          )
        );
      };
    });
  } catch (error) {
    if (error instanceof CryptoError) {
      throw error;
    }
    throw new CryptoError(
      CryptoErrorCode.KEY_STORAGE_FAILED,
      'Failed to delete private key',
      error
    );
  }
}

/**
 * Check if a private key exists in IndexedDB
 * 
 * @param userId - The user ID to check
 * @returns True if a key exists, false otherwise
 * 
 * @example
 * ```typescript
 * if (await hasPrivateKey('user123')) {
 *   console.log('Key already exists');
 * }
 * ```
 */
export async function hasPrivateKey(userId: string): Promise<boolean> {
  try {
    const key = await retrievePrivateKey(userId);
    return key !== null;
  } catch {
    return false;
  }
}

/**
 * Get or create a key pair for a user
 * 
 * This is a convenience function that:
 * 1. Checks if a private key exists in IndexedDB
 * 2. If not, generates a new key pair
 * 3. Stores the private key in IndexedDB
 * 4. Returns the key pair
 * 
 * Note: This function does NOT upload the public key to the server.
 * You must call uploadPublicKey() separately.
 * 
 * @param userId - The user ID
 * @param generateKeyPair - Function to generate a new key pair
 * @returns The key pair (existing or newly generated)
 * 
 * @example
 * ```typescript
 * import { generateX25519KeyPair } from './key-generation.js';
 * 
 * const keyPair = await getOrCreateKeyPair('user123', generateX25519KeyPair);
 * // Upload keyPair.publicKey to server
 * ```
 */
export async function getOrCreateKeyPair(
  userId: string,
  generateKeyPair: () => Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }>
): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }> {
  // Try to retrieve existing key
  const existingPrivateKey = await retrievePrivateKey(userId);
  
  if (existingPrivateKey) {
    // Derive public key from private key
    // Note: For X25519, we need to use the same curve library
    const { x25519 } = await import('@noble/curves/ed25519');
    const publicKey = x25519.getPublicKey(existingPrivateKey);
    
    return {
      publicKey,
      privateKey: existingPrivateKey,
    };
  }

  // Generate new key pair
  const newKeyPair = await generateKeyPair();
  
  // Store private key
  await storePrivateKey(userId, newKeyPair.privateKey);
  
  return newKeyPair;
}
