/**
 * Property-Based Tests for Private Key Isolation
 * 
 * **Feature: nextalk-production-upgrade, Property 13: Private Key Isolation**
 * 
 * This test verifies that for any user's X25519 private key, it only exists
 * in browser IndexedDB storage and never appears in network traffic (HTTP
 * requests, WebSocket messages, or server logs).
 * 
 * **Validates: Requirements 5.2**
 * 
 * NOTE: These tests focus on network isolation. Full IndexedDB storage tests
 * require a browser environment (use Playwright/Cypress for E2E tests).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { generateX25519KeyPair, generateX25519KeyPairSync } from './key-generation.js';
import { uploadPublicKey } from './api-client.js';
import { bytesToBase64 } from './utils.js';

// Mock fetch to intercept network requests
const networkRequests: Array<{ url: string; body: any; method: string }> = [];

beforeEach(() => {
  // Clear network request log
  networkRequests.length = 0;
  
  // Mock fetch to capture all network requests
  global.fetch = vi.fn(async (url, options) => {
    const body = options?.body ? JSON.parse(options.body as string) : null;
    networkRequests.push({
      url: url.toString(),
      body,
      method: options?.method || 'GET',
    });
    
    // Return a mock success response
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as any;
});

afterEach(() => {
  // Restore fetch
  vi.restoreAllMocks();
});

describe('Property 13: Private Key Isolation', () => {
  it('should never transmit private keys over the network when uploading public keys', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (iterations) => {
          // Clear network requests for this iteration
          networkRequests.length = 0;
          
          // Generate key pairs
          const keyPairs = [];
          for (let i = 0; i < iterations; i++) {
            keyPairs.push(await generateX25519KeyPair());
          }
          
          // Upload all public keys
          for (const keyPair of keyPairs) {
            await uploadPublicKey(keyPair.publicKey);
          }
          
          // Property: Private keys should NEVER appear in network requests
          for (const keyPair of keyPairs) {
            for (const request of networkRequests) {
              // Check request body for private key
              if (request.body) {
                const bodyString = JSON.stringify(request.body);
                
                // Private key in base64
                const privateKeyBase64 = bytesToBase64(keyPair.privateKey);
                
                // Property: Private key should not be in request body
                expect(bodyString).not.toContain(privateKeyBase64);
                
                // Property: Private key bytes should not appear in hex form
                const privateKeyHex = Array.from(keyPair.privateKey)
                  .map((b) => b.toString(16).padStart(2, '0'))
                  .join('');
                expect(bodyString.toLowerCase()).not.toContain(privateKeyHex);
                
                // Property: Check for partial key leakage (any 16-byte chunk)
                for (let j = 0; j < keyPair.privateKey.length - 16; j += 16) {
                  const chunk = Array.from(keyPair.privateKey.slice(j, j + 16))
                    .map((b) => b.toString(16).padStart(2, '0'))
                    .join('');
                  expect(bodyString.toLowerCase()).not.toContain(chunk);
                }
              }
            }
          }
          
          // Sanity check: At least one public key should be transmitted
          const allPublicKeys = keyPairs.map(kp => bytesToBase64(kp.publicKey));
          const allRequestBodies = networkRequests
            .filter(r => r.body)
            .map(r => JSON.stringify(r.body));
          
          let foundPublicKey = false;
          for (const publicKey of allPublicKeys) {
            for (const body of allRequestBodies) {
              if (body.includes(publicKey)) {
                foundPublicKey = true;
                break;
              }
            }
            if (foundPublicKey) break;
          }
          expect(foundPublicKey).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should generate different private keys for different invocations', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 20 }),
        (count) => {
          // Generate multiple key pairs
          const keyPairs = [];
          for (let i = 0; i < count; i++) {
            keyPairs.push(generateX25519KeyPairSync());
          }
          
          // Property: All private keys should be unique
          for (let i = 0; i < keyPairs.length; i++) {
            for (let j = i + 1; j < keyPairs.length; j++) {
              expect(keyPairs[i].privateKey).not.toEqual(keyPairs[j].privateKey);
            }
          }
          
          // Property: All public keys should be unique
          for (let i = 0; i < keyPairs.length; i++) {
            for (let j = i + 1; j < keyPairs.length; j++) {
              expect(keyPairs[i].publicKey).not.toEqual(keyPairs[j].publicKey);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should never log private keys to console', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (count) => {
          // Mock console methods to capture logs
          const consoleLogs: string[] = [];
          const originalConsoleLog = console.log;
          const originalConsoleError = console.error;
          const originalConsoleWarn = console.warn;
          
          console.log = vi.fn((...args: any[]) => {
            consoleLogs.push(JSON.stringify(args));
          });
          console.error = vi.fn((...args: any[]) => {
            consoleLogs.push(JSON.stringify(args));
          });
          console.warn = vi.fn((...args: any[]) => {
            consoleLogs.push(JSON.stringify(args));
          });
          
          try {
            // Generate key pairs (which might trigger logs)
            const keyPairs = [];
            for (let i = 0; i < count; i++) {
              keyPairs.push(await generateX25519KeyPair());
            }
            
            // Upload public keys (which might trigger logs)
            for (const keyPair of keyPairs) {
              await uploadPublicKey(keyPair.publicKey);
            }
            
            // Property: Private keys should not appear in console logs
            for (const keyPair of keyPairs) {
              const privateKeyBase64 = bytesToBase64(keyPair.privateKey);
              const privateKeyHex = Array.from(keyPair.privateKey)
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('');
              
              for (const log of consoleLogs) {
                expect(log).not.toContain(privateKeyBase64);
                expect(log.toLowerCase()).not.toContain(privateKeyHex);
              }
            }
          } finally {
            // Restore console methods
            console.log = originalConsoleLog;
            console.error = originalConsoleError;
            console.warn = originalConsoleWarn;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should not expose private keys through error messages', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (userId) => {
          // Generate a key pair
          const keyPair = await generateX25519KeyPair();
          
          // Try to trigger errors with invalid operations
          let caughtError: any = null;
          try {
            // Upload with invalid key length (should trigger validation error)
            const invalidKey = new Uint8Array(16); // Wrong length
            await uploadPublicKey(invalidKey);
          } catch (error) {
            caughtError = error;
          }
          
          // Property: Error messages should not contain private keys
          if (caughtError) {
            const errorString = JSON.stringify(caughtError);
            const privateKeyBase64 = bytesToBase64(keyPair.privateKey);
            const privateKeyHex = Array.from(keyPair.privateKey)
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('');
            
            expect(errorString).not.toContain(privateKeyBase64);
            expect(errorString.toLowerCase()).not.toContain(privateKeyHex);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
