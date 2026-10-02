/**
 * DM Encryption Manager with automatic key rotation
 * 
 * Provides high-level encryption/decryption functions that:
 * - Automatically fetch and cache session keys
 * - Check for key rotation triggers
 * - Rotate keys when thresholds are met
 * - Tag messages with correct key versions
 */

import {
  encryptMessage,
  decryptMessage,
  EncryptedMessage,
  SessionKeyMetadata,
} from '@nextalk/crypto';
import {
  getOrCreateSessionKey,
  fetchSessionKeyMetadata,
  deriveEncryptionKey,
  shouldRotateKey,
  rotateSessionKey,
  incrementMessageCount,
} from './session-key-client';

/**
 * Session key cache to avoid repeated API calls
 */
const sessionKeyCache = new Map<string, SessionKeyMetadata>();

/**
 * Message count cache per conversation
 */
const messageCountCache = new Map<string, number>();

/**
 * Get cached session key or fetch from server
 */
async function getCachedSessionKey(
  currentUserId: string,
  otherUserId: string
): Promise<SessionKeyMetadata> {
  const cacheKey = [currentUserId, otherUserId].sort().join('_');
  
  // Check cache first
  const cached = sessionKeyCache.get(cacheKey);
  if (cached) {
    // Verify not expired
    if (new Date() < cached.expiresAt) {
      return cached;
    }
  }
  
  // Fetch from server
  const metadata = await getOrCreateSessionKey(currentUserId, otherUserId);
  
  // Update cache
  sessionKeyCache.set(cacheKey, metadata);
  
  return metadata;
}

/**
 * Invalidate session key cache (after rotation)
 */
function invalidateSessionKeyCache(currentUserId: string, otherUserId: string) {
  const cacheKey = [currentUserId, otherUserId].sort().join('_');
  sessionKeyCache.delete(cacheKey);
  messageCountCache.delete(cacheKey);
}

/**
 * Get current message count for a conversation
 */
function getMessageCount(conversationId: string): number {
  return messageCountCache.get(conversationId) || 0;
}

/**
 * Increment local message count
 */
function incrementLocalMessageCount(conversationId: string) {
  const current = getMessageCount(conversationId);
  messageCountCache.set(conversationId, current + 1);
}

/**
 * Check if key rotation is needed and rotate if necessary
 */
async function checkAndRotateKey(
  currentUserId: string,
  otherUserId: string,
  metadata: SessionKeyMetadata
): Promise<SessionKeyMetadata> {
  const messageCount = getMessageCount(metadata.conversationId);
  
  if (shouldRotateKey(metadata, messageCount)) {
    console.log('Rotating session key:', {
      conversationId: metadata.conversationId,
      oldVersion: metadata.keyVersion,
      messageCount,
    });
    
    // Perform rotation
    const newMetadata = await rotateSessionKey(
      currentUserId,
      otherUserId,
      metadata
    );
    
    // Clear cache
    invalidateSessionKeyCache(currentUserId, otherUserId);
    
    return newMetadata;
  }
  
  return metadata;
}

/**
 * Encrypt a DM message with automatic key rotation
 * 
 * @param plaintext - Message content to encrypt
 * @param currentUserId - Current user's ID
 * @param otherUserId - Other user's ID
 * @param myPrivateKey - Current user's X25519 private key
 * @param theirPublicKey - Other user's X25519 public key
 * @returns Encrypted message with key version
 */
export async function encryptDM(
  plaintext: string,
  currentUserId: string,
  otherUserId: string,
  myPrivateKey: Uint8Array,
  theirPublicKey: Uint8Array
): Promise<EncryptedMessage> {
  try {
    // Get current session key metadata
    let metadata = await getCachedSessionKey(currentUserId, otherUserId);
    
    // Check if rotation is needed
    metadata = await checkAndRotateKey(currentUserId, otherUserId, metadata);
    
    // Derive encryption key
    const sessionKey = await deriveEncryptionKey(
      myPrivateKey,
      theirPublicKey,
      metadata
    );
    
    // Encrypt the message
    const salt = Buffer.from(metadata.salt, 'base64');
    const encrypted = await encryptMessage(
      plaintext,
      sessionKey,
      salt,
      metadata.keyVersion
    );
    
    // Increment message count locally
    incrementLocalMessageCount(metadata.conversationId);
    
    // Increment message count on server (non-blocking)
    incrementMessageCount(
      metadata.conversationId,
      metadata.keyVersion,
      1
    ).catch(err => {
      console.error('Failed to increment message count on server:', err);
    });
    
    return encrypted;
  } catch (error) {
    console.error('Error encrypting DM:', error);
    throw error;
  }
}

/**
 * Decrypt a DM message using the correct key version
 * 
 * @param encrypted - Encrypted message
 * @param currentUserId - Current user's ID
 * @param otherUserId - Other user's ID
 * @param myPrivateKey - Current user's X25519 private key
 * @param theirPublicKey - Other user's X25519 public key
 * @returns Decrypted plaintext
 */
export async function decryptDM(
  encrypted: EncryptedMessage,
  currentUserId: string,
  otherUserId: string,
  myPrivateKey: Uint8Array,
  theirPublicKey: Uint8Array
): Promise<string> {
  try {
    // Fetch the specific key version from the message
    const metadata = await fetchSessionKeyMetadata(otherUserId);
    
    if (!metadata) {
      return '[Unable to decrypt - no session key found]';
    }
    
    // Check if we have the right key version
    if (metadata.keyVersion !== encrypted.keyVersion) {
      // Try to fetch historical key version
      // For now, just return error message
      console.warn(
        `Key version mismatch: have ${metadata.keyVersion}, need ${encrypted.keyVersion}`
      );
      return '[Unable to decrypt - key version not found]';
    }
    
    // Derive decryption key
    const sessionKey = await deriveEncryptionKey(
      myPrivateKey,
      theirPublicKey,
      metadata
    );
    
    // Decrypt the message
    const plaintext = await decryptMessage(
      encrypted,
      sessionKey,
      metadata.keyVersion
    );
    
    return plaintext;
  } catch (error) {
    console.error('Error decrypting DM:', error);
    return '[Unable to decrypt message]';
  }
}

/**
 * Clear session key cache (useful for testing or after key issues)
 */
export function clearSessionKeyCache() {
  sessionKeyCache.clear();
  messageCountCache.clear();
}
