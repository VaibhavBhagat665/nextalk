/**
 * Tests for safety number (fingerprint) generation
 */

import { describe, it, expect } from 'vitest';
import { 
  generateSafetyNumber, 
  generateCompactSafetyNumber,
  verifySafetyNumber,
  generateQRCodeData,
  verifyQRCodeData
} from './fingerprint.js';
import { randomBytes } from '@noble/hashes/utils';

describe('Safety Number Generation', () => {
  // Generate test keys
  const key1 = randomBytes(32);
  const key2 = randomBytes(32);

  it('should generate a safety number', () => {
    const safetyNumber = generateSafetyNumber(key1, key2);
    
    // Should be a string with spaces
    expect(typeof safetyNumber).toBe('string');
    expect(safetyNumber.length).toBeGreaterThan(0);
    expect(safetyNumber).toContain(' ');
    
    // Should have exactly 6 groups of 5 digits
    const groups = safetyNumber.split(' ');
    expect(groups).toHaveLength(6);
    groups.forEach(group => {
      expect(group).toHaveLength(5);
      expect(/^\d+$/.test(group)).toBe(true);
    });
  });

  it('should be deterministic (same keys produce same safety number)', () => {
    const safety1 = generateSafetyNumber(key1, key2);
    const safety2 = generateSafetyNumber(key1, key2);
    
    expect(safety1).toBe(safety2);
  });

  it('should be commutative (key order does not matter)', () => {
    const safety1 = generateSafetyNumber(key1, key2);
    const safety2 = generateSafetyNumber(key2, key1);
    
    expect(safety1).toBe(safety2);
  });

  it('should produce different safety numbers for different keys', () => {
    const key3 = randomBytes(32);
    
    const safety1 = generateSafetyNumber(key1, key2);
    const safety2 = generateSafetyNumber(key1, key3);
    
    expect(safety1).not.toBe(safety2);
  });

  it('should throw error for invalid key sizes', () => {
    const shortKey = randomBytes(16); // Only 16 bytes instead of 32
    
    expect(() => generateSafetyNumber(shortKey, key2)).toThrow();
    expect(() => generateSafetyNumber(key1, shortKey)).toThrow();
  });
});

describe('Compact Safety Number', () => {
  const key1 = randomBytes(32);
  const key2 = randomBytes(32);

  it('should generate a compact safety number', () => {
    const compact = generateCompactSafetyNumber(key1, key2);
    
    // Should be shorter than full safety number
    const full = generateSafetyNumber(key1, key2);
    expect(compact.length).toBeLessThan(full.length);
    
    // Should have 3 groups of 4 digits
    const groups = compact.split(' ');
    expect(groups).toHaveLength(3);
    groups.forEach(group => {
      expect(group).toHaveLength(4);
      expect(/^\d+$/.test(group)).toBe(true);
    });
  });

  it('should be commutative', () => {
    const compact1 = generateCompactSafetyNumber(key1, key2);
    const compact2 = generateCompactSafetyNumber(key2, key1);
    
    expect(compact1).toBe(compact2);
  });
});

describe('Safety Number Verification', () => {
  const key1 = randomBytes(32);
  const key2 = randomBytes(32);

  it('should verify correct safety numbers', () => {
    const safetyNumber = generateSafetyNumber(key1, key2);
    
    const result = verifySafetyNumber(key1, key2, safetyNumber);
    expect(result).toBe(true);
  });

  it('should reject incorrect safety numbers', () => {
    const safetyNumber = '12345 67890 11111 22222 33333 44444';
    
    const result = verifySafetyNumber(key1, key2, safetyNumber);
    expect(result).toBe(false);
  });

  it('should handle safety numbers with or without spaces', () => {
    const safetyNumber = generateSafetyNumber(key1, key2);
    const noSpaces = safetyNumber.replace(/\s/g, '');
    
    const result = verifySafetyNumber(key1, key2, noSpaces);
    expect(result).toBe(true);
  });
});

describe('QR Code Generation and Verification', () => {
  const key1 = randomBytes(32);
  const key2 = randomBytes(32);
  const userId1 = 'user_1';
  const userId2 = 'user_2';

  it('should generate QR code data', () => {
    const qrData = generateQRCodeData(key1, key2, userId1, userId2);
    
    expect(typeof qrData).toBe('string');
    
    // Should be valid JSON
    const parsed = JSON.parse(qrData);
    expect(parsed.v).toBe(1);
    expect(parsed.users).toHaveLength(2);
    expect(parsed.safety).toBeTruthy();
  });

  it('should verify valid QR code data', () => {
    const qrData = generateQRCodeData(key1, key2, userId1, userId2);
    
    const result = verifyQRCodeData(qrData, userId1, userId2, key1, key2);
    
    expect(result.valid).toBe(true);
    expect(result.safetyNumber).toBeTruthy();
    expect(result.error).toBeUndefined();
  });

  it('should reject QR code with wrong user IDs', () => {
    const qrData = generateQRCodeData(key1, key2, userId1, userId2);
    
    const result = verifyQRCodeData(qrData, 'wrong_user', userId2, key1, key2);
    
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('should reject QR code with wrong keys', () => {
    const qrData = generateQRCodeData(key1, key2, userId1, userId2);
    const wrongKey = randomBytes(32);
    
    const result = verifyQRCodeData(qrData, userId1, userId2, wrongKey, key2);
    
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('should handle user IDs in any order', () => {
    const qrData = generateQRCodeData(key1, key2, userId1, userId2);
    
    // Verify with swapped user ID order
    const result = verifyQRCodeData(qrData, userId2, userId1, key2, key1);
    
    expect(result.valid).toBe(true);
  });

  it('should reject invalid JSON', () => {
    const result = verifyQRCodeData('not valid json', userId1, userId2, key1, key2);
    
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
