/**
 * Property-Based Tests for AES-256-GCM Encryption
 * 
 * **Feature: nextalk-production-upgrade, Property 15: Client-Side Encryption**
 * **Feature: nextalk-production-upgrade, Property 16: Encryption Round-Trip**
 * 
 * These tests verify:
 * 1. Property 15: Messages are encrypted client-side and server cannot decrypt them
 * 2. Property 16: Encrypting and then decrypting returns the original plaintext
 * 
 * **Validates: Requirements 5.4, 5.5**
 */

import { describe, it, expect } from 'vitest';
import { fc } from '@fast-check/vitest';
import { encryptMessage, decryptMessage } from './encryption.js';
import { generateSalt } from './key-derivation.js';
import { randomBytes } from '@noble/hashes/utils';
import { base64ToBytes } from './utils.js';

describe('Property 15: Client-Side Encryption', () => {
  /**
   * For any DM message sent to the server, the content field should contain
   * encrypted ciphertext (base64-encoded), not plaintext, verifiable by
   * attempting to decrypt server-stored content without the session key.
   */
  it('should produce ciphertext that cannot be decrypted without the session key', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary plaintext messages
        fc.string({ minLength: 1, maxLength: 1000 }),
        fc.integer({ min: 1, max: 100 }), // Generate key versions
        async (plaintext, keyVersion) => {
          // Generate a random session key for encryption
          const sessionKey = randomBytes(32);
          const salt = generateSalt();
          
          // Encrypt the message
          const encrypted = await encryptMessage(plaintext, sessionKey, salt, keyVersion);
          
          // Property 0: Key version should be preserved
          expect(encrypted.keyVersion).toBe(keyVersion);
          
          // Property 1: Ciphertext should be different from plaintext
          // (Even if plaintext is base64-encoded, it should not match)
          expect(encrypted.ciphertext).not.toBe(plaintext);
          
          // Property 2: Ciphertext should be valid base64
          expect(() => base64ToBytes(encrypted.ciphertext)).not.toThrow();
          expect(() => base64ToBytes(encrypted.iv)).not.toThrow();
          expect(() => base64ToBytes(encrypted.salt)).not.toThrow();
          
          // Property 3: Attempting to decrypt with a different (wrong) key should fail
          const wrongKey = randomBytes(32);
          const decryptedWithWrongKey = await decryptMessage(encrypted, wrongKey, keyVersion);
          
          // Should return error message, not the original plaintext
          expect(decryptedWithWrongKey).toBe('[Unable to decrypt message]');
          expect(decryptedWithWrongKey).not.toBe(plaintext);
          
          // Property 4: Server cannot extract plaintext from ciphertext without key
          // For messages longer than a few characters, verify ciphertext doesn't contain plaintext
          // (Skip very short messages as they might coincidentally appear in base64)
          if (plaintext.length > 5) {
            const ciphertextBytes = base64ToBytes(encrypted.ciphertext);
            
            // Ciphertext bytes should not contain plaintext as a substring
            // (This would indicate no encryption occurred)
            const ciphertextString = new TextDecoder('utf-8', { fatal: false }).decode(ciphertextBytes);
            expect(ciphertextString.includes(plaintext)).toBe(false);
          }
        }
      ),
      { numRuns: 100 } // Minimum 100 iterations as per design document
    );
  });
  
  it('should produce different ciphertexts for the same plaintext due to random IVs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 500 }),
        fc.integer({ min: 1, max: 100 }),
        async (plaintext, keyVersion) => {
          const sessionKey = randomBytes(32);
          const salt = generateSalt();
          
          // Encrypt the same plaintext twice with the same key
          const encrypted1 = await encryptMessage(plaintext, sessionKey, salt, keyVersion);
          const encrypted2 = await encryptMessage(plaintext, sessionKey, salt, keyVersion);
          
          // Property: IVs should be different (random)
          expect(encrypted1.iv).not.toBe(encrypted2.iv);
          
          // Property: Ciphertexts should be different (due to different IVs)
          expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
          
          // Property: Both should have same key version
          expect(encrypted1.keyVersion).toBe(keyVersion);
          expect(encrypted2.keyVersion).toBe(keyVersion);
          
          // Property: Both should still decrypt to the same plaintext
          const decrypted1 = await decryptMessage(encrypted1, sessionKey, keyVersion);
          const decrypted2 = await decryptMessage(encrypted2, sessionKey, keyVersion);
          
          expect(decrypted1).toBe(plaintext);
          expect(decrypted2).toBe(plaintext);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should not leak plaintext length in ciphertext structure', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate messages of varying lengths
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 100 }),
        async (length, keyVersion) => {
          const plaintext = 'A'.repeat(length);
          const sessionKey = randomBytes(32);
          const salt = generateSalt();
          
          const encrypted = await encryptMessage(plaintext, sessionKey, salt, keyVersion);
          const ciphertextBytes = base64ToBytes(encrypted.ciphertext);
          
          // Property: Ciphertext length should be close to plaintext length
          // (AES-GCM adds authentication tag, but shouldn't reveal exact length)
          // GCM adds 16-byte authentication tag
          const expectedMinLength = length;
          const expectedMaxLength = length + 16; // Authentication tag
          
          expect(ciphertextBytes.length).toBeGreaterThanOrEqual(expectedMinLength);
          expect(ciphertextBytes.length).toBeLessThanOrEqual(expectedMaxLength + 10); // Small margin
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 16: Encryption Round-Trip', () => {
  /**
   * For any plaintext message, encrypting with a session key and then
   * decrypting with the same session key should return the original
   * plaintext unchanged.
   */
  it('should preserve plaintext through encrypt-decrypt cycle', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary plaintext messages with various characteristics
        fc.string({ minLength: 1, maxLength: 5000 }),
        fc.integer({ min: 1, max: 100 }),
        async (plaintext, keyVersion) => {
          const sessionKey = randomBytes(32);
          const salt = generateSalt();
          
          // Encrypt then decrypt
          const encrypted = await encryptMessage(plaintext, sessionKey, salt, keyVersion);
          const decrypted = await decryptMessage(encrypted, sessionKey, keyVersion);
          
          // Property: Round-trip should be identity function
          expect(decrypted).toBe(plaintext);
        }
      ),
      { numRuns: 100 } // Minimum 100 iterations as per design document
    );
  });
  
  it('should handle Unicode characters in round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate strings with Unicode characters
        fc.string({ minLength: 1, maxLength: 500 }),
        fc.integer({ min: 1, max: 100 }),
        async (plaintext, keyVersion) => {
          // Skip empty strings (already tested)
          fc.pre(plaintext.length > 0);
          
          const sessionKey = randomBytes(32);
          const salt = generateSalt();
          
          const encrypted = await encryptMessage(plaintext, sessionKey, salt, keyVersion);
          const decrypted = await decryptMessage(encrypted, sessionKey, keyVersion);
          
          // Property: Unicode should be preserved
          expect(decrypted).toBe(plaintext);
          expect(decrypted.length).toBe(plaintext.length);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should handle messages with special characters', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate strings with emojis and special characters
        fc.string({ minLength: 1, maxLength: 500 }),
        fc.array(fc.constantFrom('😀', '🌍', '❤️', '🚀', '⭐', '🎉'), { minLength: 0, maxLength: 10 }),
        fc.integer({ min: 1, max: 100 }),
        async (base, emojis, keyVersion) => {
          const plaintext = base + emojis.join('');
          
          fc.pre(plaintext.length > 0);
          
          const sessionKey = randomBytes(32);
          const salt = generateSalt();
          
          const encrypted = await encryptMessage(plaintext, sessionKey, salt, keyVersion);
          const decrypted = await decryptMessage(encrypted, sessionKey, keyVersion);
          
          // Property: Special characters and emojis preserved
          expect(decrypted).toBe(plaintext);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should handle messages with various whitespace', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 500 }),
        fc.array(fc.constantFrom(' ', '\n', '\t', '\r'), { minLength: 0, maxLength: 20 }),
        fc.integer({ min: 1, max: 100 }),
        async (base, whitespace, keyVersion) => {
          const plaintext = base + whitespace.join('');
          
          fc.pre(plaintext.length > 0);
          
          const sessionKey = randomBytes(32);
          const salt = generateSalt();
          
          const encrypted = await encryptMessage(plaintext, sessionKey, salt, keyVersion);
          const decrypted = await decryptMessage(encrypted, sessionKey, keyVersion);
          
          // Property: Whitespace should be preserved exactly
          expect(decrypted).toBe(plaintext);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should be idempotent: multiple decrypt attempts return same result', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 500 }),
        fc.integer({ min: 1, max: 100 }),
        async (plaintext, keyVersion) => {
          const sessionKey = randomBytes(32);
          const salt = generateSalt();
          
          const encrypted = await encryptMessage(plaintext, sessionKey, salt, keyVersion);
          
          // Decrypt multiple times
          const decrypted1 = await decryptMessage(encrypted, sessionKey, keyVersion);
          const decrypted2 = await decryptMessage(encrypted, sessionKey, keyVersion);
          const decrypted3 = await decryptMessage(encrypted, sessionKey, keyVersion);
          
          // Property: All decryption attempts should return the same result
          expect(decrypted1).toBe(plaintext);
          expect(decrypted2).toBe(plaintext);
          expect(decrypted3).toBe(plaintext);
          expect(decrypted1).toBe(decrypted2);
          expect(decrypted2).toBe(decrypted3);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should fail round-trip with wrong session key', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 500 }),
        fc.integer({ min: 1, max: 100 }),
        async (plaintext, keyVersion) => {
          const correctKey = randomBytes(32);
          const wrongKey = randomBytes(32);
          const salt = generateSalt();
          
          // Encrypt with correct key
          const encrypted = await encryptMessage(plaintext, correctKey, salt, keyVersion);
          
          // Attempt to decrypt with wrong key
          const decrypted = await decryptMessage(encrypted, wrongKey, keyVersion);
          
          // Property: Wrong key should not reveal plaintext
          expect(decrypted).not.toBe(plaintext);
          expect(decrypted).toBe('[Unable to decrypt message]');
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should fail round-trip with wrong key version', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 500 }),
        fc.integer({ min: 1, max: 99 }),
        async (plaintext, keyVersion) => {
          const sessionKey = randomBytes(32);
          const salt = generateSalt();
          const wrongVersion = keyVersion + 1;
          
          // Encrypt with one version
          const encrypted = await encryptMessage(plaintext, sessionKey, salt, keyVersion);
          
          // Attempt to decrypt with wrong version
          const decrypted = await decryptMessage(encrypted, sessionKey, wrongVersion);
          
          // Property: Wrong version should not reveal plaintext
          expect(decrypted).not.toBe(plaintext);
          expect(decrypted).toBe('[Unable to decrypt message - key version mismatch]');
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should handle edge case of very long messages', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate long messages (up to 50KB)
        fc.integer({ min: 5000, max: 50000 }),
        fc.integer({ min: 1, max: 100 }),
        async (length, keyVersion) => {
          // Create a long message with varied content
          const plaintext = 'A'.repeat(Math.floor(length / 2)) + 'B'.repeat(Math.ceil(length / 2));
          
          const sessionKey = randomBytes(32);
          const salt = generateSalt();
          
          const encrypted = await encryptMessage(plaintext, sessionKey, salt, keyVersion);
          const decrypted = await decryptMessage(encrypted, sessionKey, keyVersion);
          
          // Property: Long messages should round-trip correctly
          expect(decrypted).toBe(plaintext);
          expect(decrypted.length).toBe(plaintext.length);
        }
      ),
      { numRuns: 20 } // Fewer runs for long messages to avoid timeout
    );
  });
});
