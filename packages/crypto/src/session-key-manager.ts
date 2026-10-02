/**
 * Session key management with automatic rotation
 * 
 * Implements forward secrecy by rotating session keys every:
 * - 100 messages, OR
 * - 24 hours
 * whichever comes first.
 */

import { deriveSessionKey, generateSalt, createConversationId } from './key-derivation.js';
import { SessionKeyMetadata, CryptoError, CryptoErrorCode } from './types.js';

/**
 * Session key rotation thresholds
 */
export const ROTATION_THRESHOLDS = {
  MESSAGE_COUNT: 100,
  TIME_HOURS: 24,
} as const;

/**
 * Calculate expiration time for a new session key
 * 
 * @param createdAt - Key creation timestamp
 * @returns Expiration timestamp (24 hours from creation)
 */
export function calculateExpirationTime(createdAt: Date = new Date()): Date {
  const expiresAt = new Date(createdAt);
  expiresAt.setHours(expiresAt.getHours() + ROTATION_THRESHOLDS.TIME_HOURS);
  return expiresAt;
}

/**
 * Check if a session key should be rotated
 * 
 * Rotation is triggered if:
 * 1. Message count >= 100, OR
 * 2. Current time >= expiration time
 * 
 * @param metadata - Current session key metadata
 * @param messageCount - Number of messages sent with this key
 * @returns True if key should be rotated
 */
export function shouldRotateKey(
  metadata: SessionKeyMetadata,
  messageCount: number
): boolean {
  // Check message count threshold
  if (messageCount >= ROTATION_THRESHOLDS.MESSAGE_COUNT) {
    return true;
  }
  
  // Check time threshold
  const now = new Date();
  if (now >= metadata.expiresAt) {
    return true;
  }
  
  return false;
}

/**
 * Create session key metadata for a new conversation
 * 
 * @param conversationId - Unique conversation identifier
 * @param keyVersion - Version number for this key (default: 1)
 * @returns Session key metadata
 */
export function createSessionKeyMetadata(
  conversationId: string,
  keyVersion: number = 1
): SessionKeyMetadata {
  const salt = generateSalt();
  const createdAt = new Date();
  const expiresAt = calculateExpirationTime(createdAt);
  
  return {
    conversationId,
    keyVersion,
    salt: Buffer.from(salt).toString('base64'),
    createdAt,
    expiresAt,
  };
}

/**
 * Derive a session key from shared secret and metadata
 * 
 * @param sharedSecret - ECDH shared secret
 * @param metadata - Session key metadata containing salt and conversation ID
 * @returns Derived AES-256 session key
 */
export function deriveSessionKeyFromMetadata(
  sharedSecret: Uint8Array,
  metadata: SessionKeyMetadata
): Uint8Array {
  try {
    const salt = Buffer.from(metadata.salt, 'base64');
    return deriveSessionKey(sharedSecret, salt, metadata.conversationId);
  } catch (error) {
    throw new CryptoError(
      CryptoErrorCode.KEY_DERIVATION_FAILED,
      'Failed to derive session key from metadata',
      error
    );
  }
}

/**
 * Create metadata for the next key version (rotation)
 * 
 * @param currentMetadata - Current session key metadata
 * @returns New metadata with incremented version
 */
export function rotateSessionKey(
  currentMetadata: SessionKeyMetadata
): SessionKeyMetadata {
  return createSessionKeyMetadata(
    currentMetadata.conversationId,
    currentMetadata.keyVersion + 1
  );
}

/**
 * Validate session key metadata
 * 
 * @param metadata - Session key metadata to validate
 * @throws {CryptoError} If metadata is invalid
 */
export function validateSessionKeyMetadata(metadata: SessionKeyMetadata): void {
  if (!metadata.conversationId) {
    throw new CryptoError(
      CryptoErrorCode.INVALID_KEY,
      'Session key metadata must have conversationId'
    );
  }
  
  if (!Number.isInteger(metadata.keyVersion) || metadata.keyVersion < 1) {
    throw new CryptoError(
      CryptoErrorCode.INVALID_KEY,
      'Session key version must be a positive integer'
    );
  }
  
  if (!metadata.salt) {
    throw new CryptoError(
      CryptoErrorCode.INVALID_KEY,
      'Session key metadata must have salt'
    );
  }
  
  if (!(metadata.createdAt instanceof Date) || isNaN(metadata.createdAt.getTime())) {
    throw new CryptoError(
      CryptoErrorCode.INVALID_KEY,
      'Session key metadata must have valid createdAt date'
    );
  }
  
  if (!(metadata.expiresAt instanceof Date) || isNaN(metadata.expiresAt.getTime())) {
    throw new CryptoError(
      CryptoErrorCode.INVALID_KEY,
      'Session key metadata must have valid expiresAt date'
    );
  }
  
  if (metadata.expiresAt <= metadata.createdAt) {
    throw new CryptoError(
      CryptoErrorCode.INVALID_KEY,
      'Session key expiresAt must be after createdAt'
    );
  }
}

/**
 * Check if a session key is expired
 * 
 * @param metadata - Session key metadata
 * @returns True if key is expired
 */
export function isSessionKeyExpired(metadata: SessionKeyMetadata): boolean {
  const now = new Date();
  return now >= metadata.expiresAt;
}
