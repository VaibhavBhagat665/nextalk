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
export * from './types';
export * from './key-generation';
export * from './key-derivation';
export * from './key-storage';
export * from './api-client';
export * from './encryption';
export * from './utils';
export * from './session-key-manager';
export * from './fingerprint';
