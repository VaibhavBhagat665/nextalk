/**
 * Unit tests for AES-256-GCM encryption and decryption
 */

import { describe, it, expect } from 'vitest';
import { encryptMessage, decryptMessage, generateIV } from './encryption.js';
import { generateSalt } from './key-derivation.js';
import { randomBytes } from '@noble/hashes/utils';

describe('AES-256-GCM Encryption', () => {
  it('should encrypt and decrypt a message successfully', async () => {
    // Arrange
    const plaintext = 'Hello, world!';
    const sessionKey = randomBytes(32); // 256-bit key
    const salt = generateSalt();
    const keyVersion = 1;

    // Act
    const encrypted = await encryptMessage(plaintext, sessionKey, salt, keyVersion);
    const decrypted = await decryptMessage(encrypted, sessionKey, keyVersion);

    // Assert
    expect(decrypted).toBe(plaintext);
    expect(encrypted.keyVersion).toBe(keyVersion);
  });

  it('should produce different ciphertexts for the same plaintext', async () => {
    // Arrange
    const plaintext = 'Hello, world!';
    const sessionKey = randomBytes(32);
    const salt = generateSalt();
    const keyVersion = 1;

    // Act
    const encrypted1 = await encryptMessage(plaintext, sessionKey, salt, keyVersion);
    const encrypted2 = await encryptMessage(plaintext, sessionKey, salt, keyVersion);

    // Assert - IVs should be different, so ciphertexts should differ
    expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
    expect(encrypted1.iv).not.toBe(encrypted2.iv);
    expect(encrypted1.keyVersion).toBe(keyVersion);
    expect(encrypted2.keyVersion).toBe(keyVersion);
  });

  it('should fail to decrypt with wrong key', async () => {
    // Arrange
    const plaintext = 'Secret message';
    const correctKey = randomBytes(32);
    const wrongKey = randomBytes(32);
    const salt = generateSalt();
    const keyVersion = 1;

    // Act
    const encrypted = await encryptMessage(plaintext, correctKey, salt, keyVersion);
    const decrypted = await decryptMessage(encrypted, wrongKey, keyVersion);

    // Assert - should return error message
    expect(decrypted).toBe('[Unable to decrypt message]');
  });

  it('should handle key version mismatch', async () => {
    // Arrange
    const plaintext = 'Secret message';
    const sessionKey = randomBytes(32);
    const salt = generateSalt();
    const keyVersion = 1;

    // Act
    const encrypted = await encryptMessage(plaintext, sessionKey, salt, keyVersion);
    const decrypted = await decryptMessage(encrypted, sessionKey, 2); // Wrong version

    // Assert - should return error message
    expect(decrypted).toBe('[Unable to decrypt message - key version mismatch]');
  });

  it('should handle empty plaintext', async () => {
    // Arrange
    const plaintext = '';
    const sessionKey = randomBytes(32);
    const salt = generateSalt();
    const keyVersion = 1;

    // Act & Assert
    await expect(encryptMessage(plaintext, sessionKey, salt, keyVersion)).rejects.toThrow();
  });

  it('should handle long messages', async () => {
    // Arrange
    const plaintext = 'A'.repeat(10000); // 10KB message
    const sessionKey = randomBytes(32);
    const salt = generateSalt();
    const keyVersion = 1;

    // Act
    const encrypted = await encryptMessage(plaintext, sessionKey, salt, keyVersion);
    const decrypted = await decryptMessage(encrypted, sessionKey, keyVersion);

    // Assert
    expect(decrypted).toBe(plaintext);
  });

  it('should handle Unicode characters', async () => {
    // Arrange
    const plaintext = 'Hello 世界 🌍 Привет мир';
    const sessionKey = randomBytes(32);
    const salt = generateSalt();
    const keyVersion = 1;

    // Act
    const encrypted = await encryptMessage(plaintext, sessionKey, salt, keyVersion);
    const decrypted = await decryptMessage(encrypted, sessionKey, keyVersion);

    // Assert
    expect(decrypted).toBe(plaintext);
  });

  it('should require 32-byte session key for encryption', async () => {
    // Arrange
    const plaintext = 'Hello, world!';
    const invalidKey = randomBytes(16); // Wrong size
    const salt = generateSalt();
    const keyVersion = 1;

    // Act & Assert
    await expect(encryptMessage(plaintext, invalidKey, salt, keyVersion)).rejects.toThrow(
      'Session key must be 32 bytes'
    );
  });

  it('should require valid key version for encryption', async () => {
    // Arrange
    const plaintext = 'Hello, world!';
    const sessionKey = randomBytes(32);
    const salt = generateSalt();
    const invalidKeyVersion = 0;

    // Act & Assert
    await expect(encryptMessage(plaintext, sessionKey, salt, invalidKeyVersion)).rejects.toThrow(
      'Key version must be a positive integer'
    );
  });

  it('should require 32-byte session key for decryption', async () => {
    // Arrange
    const invalidKey = randomBytes(16);
    const encrypted = {
      ciphertext: 'dGVzdA==',
      iv: 'dGVzdGl2',
      salt: 'dGVzdHNhbHQ=',
      keyVersion: 1,
    };

    // Act & Assert
    await expect(decryptMessage(encrypted, invalidKey, 1)).rejects.toThrow(
      'Session key must be 32 bytes'
    );
  });

  it('should handle corrupted ciphertext gracefully', async () => {
    // Arrange
    const sessionKey = randomBytes(32);
    const encrypted = {
      ciphertext: 'corrupted!!!',
      iv: 'YWJjZGVmZ2hpamts', // Valid base64 IV
      salt: 'dGVzdHNhbHQ=',
      keyVersion: 1,
    };

    // Act
    const decrypted = await decryptMessage(encrypted, sessionKey, 1);

    // Assert
    expect(decrypted).toBe('[Unable to decrypt message]');
  });

  it('should generate 12-byte IVs', () => {
    // Act
    const iv1 = generateIV();
    const iv2 = generateIV();

    // Assert
    expect(iv1.length).toBe(12);
    expect(iv2.length).toBe(12);
    expect(iv1).not.toEqual(iv2); // Should be random
  });
});
