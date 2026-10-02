/**
 * Property-Based Tests for Session Key Derivation
 * 
 * **Feature: nextalk-production-upgrade, Property 14: Session Key Derivation Consistency**
 * 
 * This test verifies that two users A and B in a DM conversation both
 * independently derive the same session key from their private keys and
 * each other's public keys via ECDH+HKDF.
 * 
 * **Validates: Requirements 5.3**
 */

import { describe, it, expect } from 'vitest';
import { fc } from '@fast-check/vitest';
import {
  deriveSharedSecret,
  deriveSessionKey,
  generateSalt,
  createConversationId,
} from './key-derivation.js';
import { generateX25519KeyPair } from './key-generation.js';

describe('Property 14: Session Key Derivation Consistency', () => {
  it('should always derive the same session key for both parties in a DM conversation', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary user IDs
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        async (userIdA, userIdB) => {
          // Skip if both user IDs are the same (edge case we'll handle separately)
          fc.pre(userIdA !== userIdB);
          
          // Step 1: Both users generate their key pairs
          const aliceKeyPair = await generateX25519KeyPair();
          const bobKeyPair = await generateX25519KeyPair();
          
          // Step 2: Alice derives shared secret using her private key and Bob's public key
          const aliceSharedSecret = deriveSharedSecret(
            aliceKeyPair.privateKey,
            bobKeyPair.publicKey
          );
          
          // Step 3: Bob derives shared secret using his private key and Alice's public key
          const bobSharedSecret = deriveSharedSecret(
            bobKeyPair.privateKey,
            aliceKeyPair.publicKey
          );
          
          // Property: Both should derive the same shared secret
          expect(aliceSharedSecret).toEqual(bobSharedSecret);
          
          // Step 4: Both users derive session key with the same salt
          const salt = generateSalt();
          const conversationId = createConversationId(userIdA, userIdB);
          
          const aliceSessionKey = deriveSessionKey(
            aliceSharedSecret,
            salt,
            conversationId
          );
          
          const bobSessionKey = deriveSessionKey(
            bobSharedSecret,
            salt,
            conversationId
          );
          
          // Property: Both should derive the same session key
          expect(aliceSessionKey).toEqual(bobSessionKey);
          
          // Property: Session key should be 32 bytes (256 bits for AES-256)
          expect(aliceSessionKey.length).toBe(32);
          expect(bobSessionKey.length).toBe(32);
        }
      ),
      { numRuns: 100 } // Minimum 100 iterations as per design document
    );
  });
  
  it('should derive consistent session keys regardless of user ID order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        async (userIdA, userIdB) => {
          fc.pre(userIdA !== userIdB);
          
          const aliceKeyPair = await generateX25519KeyPair();
          const bobKeyPair = await generateX25519KeyPair();
          
          const sharedSecret = deriveSharedSecret(
            aliceKeyPair.privateKey,
            bobKeyPair.publicKey
          );
          
          const salt = generateSalt();
          
          // Create conversation ID in both orders
          const conversationIdAB = createConversationId(userIdA, userIdB);
          const conversationIdBA = createConversationId(userIdB, userIdA);
          
          // Property: Conversation ID should be the same regardless of order
          expect(conversationIdAB).toBe(conversationIdBA);
          
          // Derive session keys with the same parameters
          const sessionKeyAB = deriveSessionKey(sharedSecret, salt, conversationIdAB);
          const sessionKeyBA = deriveSessionKey(sharedSecret, salt, conversationIdBA);
          
          // Property: Session keys should be identical
          expect(sessionKeyAB).toEqual(sessionKeyBA);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should derive different session keys for different conversation pairs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        async (userIdA, userIdB, userIdC) => {
          // Ensure all three users are distinct
          fc.pre(userIdA !== userIdB && userIdA !== userIdC && userIdB !== userIdC);
          
          // Generate key pairs for all three users
          const aliceKeyPair = await generateX25519KeyPair();
          const bobKeyPair = await generateX25519KeyPair();
          const charlieKeyPair = await generateX25519KeyPair();
          
          // Alice-Bob conversation
          const aliceBobSecret = deriveSharedSecret(
            aliceKeyPair.privateKey,
            bobKeyPair.publicKey
          );
          
          // Alice-Charlie conversation
          const aliceCharlieSecret = deriveSharedSecret(
            aliceKeyPair.privateKey,
            charlieKeyPair.publicKey
          );
          
          const salt = generateSalt();
          
          const aliceBobSessionKey = deriveSessionKey(
            aliceBobSecret,
            salt,
            createConversationId(userIdA, userIdB)
          );
          
          const aliceCharlieSessionKey = deriveSessionKey(
            aliceCharlieSecret,
            salt,
            createConversationId(userIdA, userIdC)
          );
          
          // Property: Different conversation pairs should have different session keys
          expect(aliceBobSessionKey).not.toEqual(aliceCharlieSessionKey);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should derive different session keys with different salts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        async (userIdA, userIdB) => {
          fc.pre(userIdA !== userIdB);
          
          const aliceKeyPair = await generateX25519KeyPair();
          const bobKeyPair = await generateX25519KeyPair();
          
          const sharedSecret = deriveSharedSecret(
            aliceKeyPair.privateKey,
            bobKeyPair.publicKey
          );
          
          const conversationId = createConversationId(userIdA, userIdB);
          
          // Generate two different salts
          const salt1 = generateSalt();
          const salt2 = generateSalt();
          
          const sessionKey1 = deriveSessionKey(sharedSecret, salt1, conversationId);
          const sessionKey2 = deriveSessionKey(sharedSecret, salt2, conversationId);
          
          // Property: Different salts should produce different session keys
          // (This enables key rotation for forward secrecy)
          expect(sessionKey1).not.toEqual(sessionKey2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
