/**
 * Utility functions for encoding, decoding, and key management
 */

/**
 * Convert Uint8Array to base64 string
 * 
 * @param bytes - Byte array to encode
 * @returns Base64-encoded string
 */
export function bytesToBase64(bytes: Uint8Array): string {
  // Use Buffer in Node.js environment
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  
  // Use btoa in browser environment
  if (typeof btoa !== 'undefined') {
    const binary = String.fromCharCode(...bytes);
    return btoa(binary);
  }
  
  throw new Error('No base64 encoding method available');
}

/**
 * Convert base64 string to Uint8Array
 * 
 * @param base64 - Base64-encoded string
 * @returns Decoded byte array
 */
export function base64ToBytes(base64: string): Uint8Array {
  // Use Buffer in Node.js environment
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  
  // Use atob in browser environment
  if (typeof atob !== 'undefined') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  
  throw new Error('No base64 decoding method available');
}

/**
 * Convert hex string to Uint8Array
 * 
 * @param hex - Hex-encoded string
 * @returns Decoded byte array
 */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Hex string must have even length');
  }
  
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 * 
 * @param bytes - Byte array to encode
 * @returns Hex-encoded string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Securely compare two byte arrays in constant time
 * 
 * Prevents timing attacks when comparing secrets
 * 
 * @param a - First byte array
 * @param b - Second byte array
 * @returns True if arrays are equal
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  
  return result === 0;
}

/**
 * Securely zero out a byte array
 * 
 * Overwrites the array with zeros to prevent memory snooping
 * 
 * @param bytes - Byte array to zero out
 */
export function secureZero(bytes: Uint8Array): void {
  bytes.fill(0);
}

/**
 * Generate a fingerprint (safety number) from two public keys
 * 
 * Creates a human-readable fingerprint that users can compare
 * to verify they're talking to the right person.
 * 
 * @param publicKey1 - First public key
 * @param publicKey2 - Second public key
 * @returns Fingerprint string (e.g., "12345 67890 12345...")
 */
export function generateFingerprint(
  publicKey1: Uint8Array,
  publicKey2: Uint8Array
): string {
  // Concatenate public keys in sorted order for deterministic fingerprint
  const keys = [publicKey1, publicKey2].sort((a, b) => {
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return a[i] - b[i];
    }
    return 0;
  });
  
  const combined = new Uint8Array(keys[0].length + keys[1].length);
  combined.set(keys[0], 0);
  combined.set(keys[1], keys[0].length);
  
  // Create readable groups of 5 digits
  const hex = bytesToHex(combined);
  const groups: string[] = [];
  
  for (let i = 0; i < 60; i += 5) {
    if (i < hex.length) {
      groups.push(hex.slice(i, i + 5));
    }
  }
  
  return groups.join(' ');
}
