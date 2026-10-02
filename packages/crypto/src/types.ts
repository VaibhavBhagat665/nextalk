/**
 * Type definitions for the crypto package
 */

/**
 * X25519 key pair consisting of public and private keys
 */
export interface KeyPair {
  /** 32-byte public key */
  publicKey: Uint8Array;
  /** 32-byte private key (must be kept secret) */
  privateKey: Uint8Array;
}

/**
 * Encrypted message payload
 */
export interface EncryptedMessage {
  /** Base64-encoded ciphertext */
  ciphertext: string;
  /** Base64-encoded initialization vector (96 bits for GCM) */
  iv: string;
  /** Salt used for key derivation */
  salt: string;
  /** Key version for rotation support (required) */
  keyVersion: number;
}

/**
 * Session key metadata for key rotation
 */
export interface SessionKeyMetadata {
  /** Unique conversation identifier */
  conversationId: string;
  /** Current key version */
  keyVersion: number;
  /** Salt for HKDF */
  salt: string;
  /** Key creation timestamp */
  createdAt: Date;
  /** Key expiration timestamp */
  expiresAt: Date;
}

/**
 * Crypto error types
 */
export enum CryptoErrorCode {
  KEY_GENERATION_FAILED = 'KEY_GENERATION_FAILED',
  KEY_DERIVATION_FAILED = 'KEY_DERIVATION_FAILED',
  KEY_STORAGE_FAILED = 'KEY_STORAGE_FAILED',
  KEY_RETRIEVAL_FAILED = 'KEY_RETRIEVAL_FAILED',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  INVALID_KEY = 'INVALID_KEY',
  INVALID_CIPHERTEXT = 'INVALID_CIPHERTEXT',
}

/**
 * Custom error class for crypto operations
 */
export class CryptoError extends Error {
  constructor(
    public code: CryptoErrorCode,
    message: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = 'CryptoError';
  }
}
