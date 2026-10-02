/**
 * @nextalk/crypto - Shared cryptographic utilities package
 * 
 * This package provides X25519 key exchange and AES-256-GCM encryption
 * for end-to-end encrypted direct messages in NexTalk.
 * 
 * Features:
 * - X25519 ECDH key exchange
 * - HKDF key derivation
 * - AES-256-GCM encryption/decryption
 * - IndexedDB key storage
 * - API client for public key sync
 * - Cross-platform support (Web and React Native)
 */

// Re-export all utilities from submodules
export * from './types.js';
export * from './key-generation.js';
export * from './key-derivation.js';
export * from './key-storage.js';
export * from './api-client.js';
export * from './encryption.js';
export * from './utils.js';
export * from './session-key-manager.js';
