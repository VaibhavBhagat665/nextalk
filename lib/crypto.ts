/**
 * E2E Encryption Library — AES-256-GCM + ECDH Key Exchange
 * Uses Web Crypto API for browser-native, high-performance encryption.
 *
 * Flow:
 * 1. Each user generates an ECDH P-256 key pair on first DM
 * 2. Public key is stored on the server (UserSettings.publicKey)
 * 3. Private key is stored in IndexedDB (never leaves the browser)
 * 4. Shared secret is derived via ECDH for each DM pair
 * 5. Messages are encrypted with AES-256-GCM using the shared secret
 */

const DB_NAME = "nextalk-keys";
const STORE_NAME = "crypto-keys";

// ── IndexedDB Helpers ──────────────────────────────────────

function openKeyStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeKey(id: string, key: CryptoKey): Promise<void> {
  const db = await openKeyStore();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const exported = await crypto.subtle.exportKey("jwk", key);
  store.put(exported, id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function retrieveKey(id: string): Promise<CryptoKey | null> {
  const db = await openKeyStore();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const request = store.get(id);
  return new Promise((resolve, reject) => {
    request.onsuccess = async () => {
      if (!request.result) return resolve(null);
      try {
        const key = await crypto.subtle.importKey(
          "jwk",
          request.result,
          { name: "ECDH", namedCurve: "P-256" },
          true,
          ["deriveKey"]
        );
        resolve(key);
      } catch {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// ── Key Generation ─────────────────────────────────────────

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );
}

export async function exportPublicKey(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey("jwk", key);
}

export async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
}

// ── Key Storage ────────────────────────────────────────────

export async function getOrCreateKeyPair(userId: string): Promise<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}> {
  const existingPrivate = await retrieveKey(`private-${userId}`);
  const existingPublic = await retrieveKey(`public-${userId}`);

  if (existingPrivate && existingPublic) {
    return { publicKey: existingPublic, privateKey: existingPrivate };
  }

  const keyPair = await generateKeyPair();
  await storeKey(`private-${userId}`, keyPair.privateKey);
  await storeKey(`public-${userId}`, keyPair.publicKey);
  return keyPair;
}

// ── Shared Secret Derivation ───────────────────────────────

export async function deriveSharedKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ── Encryption / Decryption ────────────────────────────────

export async function encryptMessage(
  plaintext: string,
  sharedKey: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    data
  );

  return {
    ciphertext: bufferToBase64(encrypted),
    iv: bufferToBase64(iv.buffer),
  };
}

export async function decryptMessage(
  ciphertext: string,
  iv: string,
  sharedKey: CryptoKey
): Promise<string> {
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBuffer(iv) },
      sharedKey,
      base64ToBuffer(ciphertext)
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch {
    return "[Unable to decrypt message]";
  }
}

// ── Helpers ────────────────────────────────────────────────

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ── Key Export for Backup ──────────────────────────────────

export async function exportKeysForBackup(userId: string): Promise<string> {
  const db = await openKeyStore();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);

  const privateReq = store.get(`private-${userId}`);
  const publicReq = store.get(`public-${userId}`);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      const backup = {
        version: 1,
        userId,
        exportedAt: new Date().toISOString(),
        privateKey: privateReq.result,
        publicKey: publicReq.result,
      };
      resolve(JSON.stringify(backup, null, 2));
    };
    tx.onerror = () => reject(tx.error);
  });
}
