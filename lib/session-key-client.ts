/**
 * Client-side session key management
 * 
 * Handles automatic key rotation based on message count and time thresholds
 */

import {
  createConversationId,
  deriveSharedSecret,
  deriveSessionKey,
  generateSalt,
  SessionKeyMetadata,
} from '@nextalk/crypto';

/**
 * Fetch current session key metadata from server
 */
export async function fetchSessionKeyMetadata(
  otherUserId: string
): Promise<SessionKeyMetadata | null> {
  try {
    const response = await fetch(
      `/api/dm-session-keys?otherUserId=${otherUserId}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch session key metadata');
    }
    
    const data = await response.json();
    
    if (!data.sessionKey) {
      return null;
    }
    
    // Convert ISO strings back to Date objects
    return {
      ...data.sessionKey,
      createdAt: new Date(data.sessionKey.createdAt),
      expiresAt: new Date(data.sessionKey.expiresAt),
    };
  } catch (error) {
    console.error('Error fetching session key metadata:', error);
    return null;
  }
}

/**
 * Create a new session key on the server
 */
export async function createSessionKey(
  otherUserId: string,
  salt: string,
  keyVersion?: number
): Promise<SessionKeyMetadata> {
  try {
    const response = await fetch('/api/dm-session-keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        otherUserId,
        salt,
        keyVersion,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create session key');
    }
    
    const data = await response.json();
    
    // Convert ISO strings back to Date objects
    return {
      ...data.sessionKey,
      createdAt: new Date(data.sessionKey.createdAt),
      expiresAt: new Date(data.sessionKey.expiresAt),
    };
  } catch (error) {
    console.error('Error creating session key:', error);
    throw error;
  }
}

/**
 * Increment message count for a session key
 */
export async function incrementMessageCount(
  conversationId: string,
  keyVersion: number,
  increment: number = 1
): Promise<void> {
  try {
    const response = await fetch(
      `/api/dm-session-keys?conversationId=${conversationId}&keyVersion=${keyVersion}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ increment }),
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to increment message count');
    }
  } catch (error) {
    console.error('Error incrementing message count:', error);
    // Non-critical error, don't throw
  }
}

/**
 * Delete an old session key after rotation
 */
export async function deleteSessionKey(
  conversationId: string,
  keyVersion: number
): Promise<void> {
  try {
    const response = await fetch(
      `/api/dm-session-keys?conversationId=${conversationId}&keyVersion=${keyVersion}`,
      {
        method: 'DELETE',
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to delete session key');
    }
  } catch (error) {
    console.error('Error deleting session key:', error);
    // Non-critical error, don't throw
  }
}

/**
 * Check if key rotation is needed based on metadata
 */
export function shouldRotateKey(
  metadata: SessionKeyMetadata,
  messageCount: number
): boolean {
  // Check message count threshold (100 messages)
  if (messageCount >= 100) {
    return true;
  }
  
  // Check time threshold (24 hours)
  const now = new Date();
  if (now >= metadata.expiresAt) {
    return true;
  }
  
  return false;
}

/**
 * Rotate session key: create new key and delete old one
 */
export async function rotateSessionKey(
  currentUserId: string,
  otherUserId: string,
  currentMetadata: SessionKeyMetadata
): Promise<SessionKeyMetadata> {
  try {
    // Generate new salt for the new key
    const newSalt = generateSalt();
    const newSaltBase64 = Buffer.from(newSalt).toString('base64');
    
    // Create new key with incremented version
    const newMetadata = await createSessionKey(
      otherUserId,
      newSaltBase64,
      currentMetadata.keyVersion + 1
    );
    
    // Delete old key to maintain forward secrecy
    await deleteSessionKey(
      currentMetadata.conversationId,
      currentMetadata.keyVersion
    );
    
    return newMetadata;
  } catch (error) {
    console.error('Error rotating session key:', error);
    throw error;
  }
}

/**
 * Get or create session key metadata for a conversation
 */
export async function getOrCreateSessionKey(
  currentUserId: string,
  otherUserId: string
): Promise<SessionKeyMetadata> {
  try {
    // Try to fetch existing key
    const existing = await fetchSessionKeyMetadata(otherUserId);
    
    if (existing) {
      return existing;
    }
    
    // Create new key if none exists
    const salt = generateSalt();
    const saltBase64 = Buffer.from(salt).toString('base64');
    
    return await createSessionKey(otherUserId, saltBase64, 1);
  } catch (error) {
    console.error('Error getting or creating session key:', error);
    throw error;
  }
}

/**
 * Derive the actual encryption key from metadata and key pair
 */
export async function deriveEncryptionKey(
  myPrivateKey: Uint8Array,
  theirPublicKey: Uint8Array,
  metadata: SessionKeyMetadata
): Promise<Uint8Array> {
  try {
    // Perform ECDH to get shared secret
    const sharedSecret = deriveSharedSecret(myPrivateKey, theirPublicKey);
    
    // Derive session key using HKDF
    const salt = Buffer.from(metadata.salt, 'base64');
    const sessionKey = deriveSessionKey(
      sharedSecret,
      salt,
      metadata.conversationId
    );
    
    return sessionKey;
  } catch (error) {
    console.error('Error deriving encryption key:', error);
    throw error;
  }
}
