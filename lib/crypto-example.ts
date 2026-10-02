/**
 * Example usage of @nextalk/crypto package
 * 
 * This file demonstrates how to use the shared crypto utilities
 * from the main Next.js application.
 */

import {
  generateX25519KeyPair,
  deriveSharedSecret,
  deriveSessionKey,
  generateSalt,
  createConversationId,
  bytesToBase64,
  type KeyPair,
} from '@nextalk/crypto';

/**
 * Example: Initialize E2E encryption for a DM conversation
 */
export async function initializeDMEncryption(
  myUserId: string,
  otherUserId: string,
  otherUserPublicKey: string
) {
  // 1. Generate or retrieve your key pair
  const myKeyPair = generateX25519KeyPair();
  
  // 2. Store your private key securely (IndexedDB)
  // await storePrivateKeyInIndexedDB(myUserId, myKeyPair.privateKey);
  
  // 3. Upload your public key to server
  const myPublicKeyBase64 = bytesToBase64(myKeyPair.publicKey);
  // await uploadPublicKeyToServer(myUserId, myPublicKeyBase64);
  
  // 4. Get the conversation ID
  const conversationId = createConversationId(myUserId, otherUserId);
  
  // 5. Derive shared secret via ECDH
  const otherPublicKey = Uint8Array.from(atob(otherUserPublicKey), c => c.charCodeAt(0));
  const sharedSecret = deriveSharedSecret(myKeyPair.privateKey, otherPublicKey);
  
  // 6. Generate salt and derive session key
  const salt = generateSalt();
  const sessionKey = deriveSessionKey(sharedSecret, salt, conversationId);
  
  return {
    sessionKey,
    salt: bytesToBase64(salt),
    conversationId,
  };
}
