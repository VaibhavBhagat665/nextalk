/**
 * Property-Based Test for AI Response Caching
 * 
 * Feature: nextalk-production-upgrade, Property 12: AI Response Caching
 * Validates: Requirements 4.8
 * 
 * Property: For any AI query, generating a response for the first time should 
 * hit the AI API, but repeating the identical query within the cache TTL should 
 * return the cached response without hitting the AI API.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fc from "fast-check";

// Create mock Redis instance before importing
const mockRedisGet = vi.fn();
const mockRedisSetex = vi.fn();
const mockRedisKeys = vi.fn();
const mockRedisDel = vi.fn();

const mockRedis = {
  get: mockRedisGet,
  setex: mockRedisSetex,
  keys: mockRedisKeys,
  del: mockRedisDel,
};

// Mock Redis module
vi.mock("./redis", () => ({
  redis: mockRedis,
}));

// Import after mocking
const {
  generateQueryHash,
  getCachedAIResponse,
  cacheAIResponse,
} = await import("./ai-cache");

describe("Property 12: AI Response Caching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Core Property Test: Cache miss on first query, cache hit on second
   * 
   * This is the primary property that validates Requirement 4.8:
   * "For any AI query, generating a response for the first time should hit 
   * the AI API, but repeating the identical query within the cache TTL should 
   * return the cached response without hitting the AI API."
   * 
   * We simulate this by:
   * 1. First query returns null (cache miss)
   * 2. We cache the response
   * 3. Second identical query returns cached data (cache hit)
   */
  it("should cache miss on first query and cache hit on second identical query", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          query: fc.string({ minLength: 5, maxLength: 200 }),
          channelId: fc.uuid(),
          topK: fc.integer({ min: 1, max: 20 }),
          answer: fc.string({ minLength: 10, maxLength: 500 }),
          context: fc.string({ minLength: 20, maxLength: 1000 }),
          sources: fc.integer({ min: 1, max: 10 }),
        }),
        async ({ query, channelId, topK, answer, context, sources }) => {
          // Reset mocks for each iteration
          mockRedisGet.mockClear();
          mockRedisSetex.mockClear();

          // FIRST QUERY: Cache miss
          mockRedisGet.mockResolvedValueOnce(null);

          const firstResult = await getCachedAIResponse(query, channelId, topK);

          // Assert: First query should return null (cache miss)
          expect(firstResult).toBeNull();
          expect(mockRedisGet).toHaveBeenCalledTimes(1);

          // Now cache the response
          const response = {
            answer,
            context,
            sources,
            timestamp: new Date().toISOString(),
          };

          await cacheAIResponse(query, channelId, response, topK);

          // Assert: Response was cached
          expect(mockRedisSetex).toHaveBeenCalledTimes(1);
          expect(mockRedisSetex).toHaveBeenCalledWith(
            expect.stringContaining("nextalk:ai:response:"),
            60 * 60 * 24, // 24 hour TTL
            expect.any(String)
          );

          // SECOND QUERY: Cache hit
          const cachedData = {
            ...response,
            cachedAt: new Date().toISOString(),
          };
          mockRedisGet.mockResolvedValueOnce(JSON.stringify(cachedData));

          const secondResult = await getCachedAIResponse(query, channelId, topK);

          // Assert: Second identical query should return cached data
          expect(secondResult).not.toBeNull();
          expect(secondResult?.answer).toBe(answer);
          expect(secondResult?.context).toBe(context);
          expect(secondResult?.sources).toBe(sources);

          // Assert: Redis get was called again
          expect(mockRedisGet).toHaveBeenCalledTimes(2);
        }
      ),
      { numRuns: 100 } // Run 100 iterations with random queries
    );
  });

  /**
   * Property Test: Query normalization ensures cache hits
   * 
   * Queries that differ only in whitespace or case should produce
   * cache hits because they normalize to the same hash.
   */
  it("should normalize queries for consistent cache hits", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          baseQuery: fc.string({ minLength: 5, maxLength: 100 })
            .filter(s => s.trim().length > 0),
          channelId: fc.uuid(),
          topK: fc.integer({ min: 1, max: 10 }),
        }),
        async ({ baseQuery, channelId, topK }) => {
          // Generate variations of the same query
          const queries = [
            baseQuery,
            baseQuery.toUpperCase(),
            baseQuery.toLowerCase(),
            `  ${baseQuery}  `, // Extra whitespace
            `\t${baseQuery}\n`, // Tabs and newlines
          ];

          // All variations should produce the same hash
          const hashes = queries.map(q => generateQueryHash(q, channelId, topK));
          
          // Assert: All hashes should be identical
          const firstHash = hashes[0];
          for (const hash of hashes) {
            expect(hash).toBe(firstHash);
          }

          // Verify cache behavior: cache the first variant
          mockRedisGet.mockResolvedValueOnce(null);
          const firstResult = await getCachedAIResponse(queries[0], channelId, topK);
          expect(firstResult).toBeNull();

          const response = {
            answer: "Test answer",
            context: "Test context",
            sources: 1,
            timestamp: new Date().toISOString(),
          };

          await cacheAIResponse(queries[0], channelId, response, topK);

          // Now all other variants should produce cache hits
          for (let i = 1; i < queries.length; i++) {
            mockRedisGet.mockResolvedValueOnce(
              JSON.stringify({
                ...response,
                cachedAt: new Date().toISOString(),
              })
            );

            const result = await getCachedAIResponse(queries[i], channelId, topK);
            expect(result).not.toBeNull();
            expect(result?.answer).toBe("Test answer");
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property Test: Different queries produce different cache keys
   * 
   * Queries that differ in content, channel, or topK should NOT
   * produce cache hits for each other.
   */
  it("should produce different cache keys for different queries", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          query1: fc.string({ minLength: 5, maxLength: 100 }),
          query2: fc.string({ minLength: 5, maxLength: 100 }),
          channelId: fc.uuid(),
          topK: fc.integer({ min: 1, max: 10 }),
        }).filter(({ query1, query2 }) => 
          // Ensure queries are actually different after normalization
          query1.trim().toLowerCase() !== query2.trim().toLowerCase()
        ),
        async ({ query1, query2, channelId, topK }) => {
          // Generate hashes for different queries
          const hash1 = generateQueryHash(query1, channelId, topK);
          const hash2 = generateQueryHash(query2, channelId, topK);

          // Assert: Different queries should produce different hashes
          expect(hash1).not.toBe(hash2);

          // Cache response for query1
          mockRedisGet.mockResolvedValueOnce(null);
          await getCachedAIResponse(query1, channelId, topK);

          const response1 = {
            answer: "Answer for query 1",
            context: "Context 1",
            sources: 1,
            timestamp: new Date().toISOString(),
          };

          await cacheAIResponse(query1, channelId, response1, topK);

          // Mock cache hit for query1
          mockRedisGet.mockResolvedValueOnce(
            JSON.stringify({
              ...response1,
              cachedAt: new Date().toISOString(),
            })
          );

          const cachedResult1 = await getCachedAIResponse(query1, channelId, topK);
          expect(cachedResult1?.answer).toBe("Answer for query 1");

          // Query2 should still be a cache miss (different query)
          mockRedisGet.mockResolvedValueOnce(null);
          const result2 = await getCachedAIResponse(query2, channelId, topK);
          expect(result2).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Different channels produce different cache keys
   * 
   * The same query in different channels should NOT produce cache hits
   * for each other.
   */
  it("should isolate cache by channel ID", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          query: fc.string({ minLength: 5, maxLength: 100 }),
          channel1: fc.uuid(),
          channel2: fc.uuid(),
          topK: fc.integer({ min: 1, max: 10 }),
        }).filter(({ channel1, channel2 }) => channel1 !== channel2),
        async ({ query, channel1, channel2, topK }) => {
          // Generate hashes for same query in different channels
          const hash1 = generateQueryHash(query, channel1, topK);
          const hash2 = generateQueryHash(query, channel2, topK);

          // Assert: Same query in different channels should have different hashes
          expect(hash1).not.toBe(hash2);

          // Cache response for channel1
          const response1 = {
            answer: "Answer for channel 1",
            context: "Context from channel 1",
            sources: 2,
            timestamp: new Date().toISOString(),
          };

          mockRedisGet.mockResolvedValueOnce(null);
          await getCachedAIResponse(query, channel1, topK);
          await cacheAIResponse(query, channel1, response1, topK);

          // Cache hit for channel1
          mockRedisGet.mockResolvedValueOnce(
            JSON.stringify({
              ...response1,
              cachedAt: new Date().toISOString(),
            })
          );

          const cachedResult1 = await getCachedAIResponse(query, channel1, topK);
          expect(cachedResult1?.answer).toBe("Answer for channel 1");

          // Same query in channel2 should be a cache miss
          mockRedisGet.mockResolvedValueOnce(null);
          const result2 = await getCachedAIResponse(query, channel2, topK);
          expect(result2).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property Test: Different topK values produce different cache keys
   * 
   * The same query with different topK parameters should NOT produce
   * cache hits for each other.
   */
  it("should isolate cache by topK parameter", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          query: fc.string({ minLength: 5, maxLength: 100 }),
          channelId: fc.uuid(),
          topK1: fc.integer({ min: 1, max: 10 }),
          topK2: fc.integer({ min: 11, max: 20 }),
        }),
        async ({ query, channelId, topK1, topK2 }) => {
          // Generate hashes for same query with different topK
          const hash1 = generateQueryHash(query, channelId, topK1);
          const hash2 = generateQueryHash(query, channelId, topK2);

          // Assert: Different topK should produce different hashes
          expect(hash1).not.toBe(hash2);

          // Cache response with topK1
          const response1 = {
            answer: "Answer with topK1",
            context: "Context 1",
            sources: topK1,
            timestamp: new Date().toISOString(),
          };

          mockRedisGet.mockResolvedValueOnce(null);
          await getCachedAIResponse(query, channelId, topK1);
          await cacheAIResponse(query, channelId, response1, topK1);

          // Cache hit with topK1
          mockRedisGet.mockResolvedValueOnce(
            JSON.stringify({
              ...response1,
              cachedAt: new Date().toISOString(),
            })
          );

          const cachedResult1 = await getCachedAIResponse(query, channelId, topK1);
          expect(cachedResult1?.sources).toBe(topK1);

          // Same query with different topK should be a cache miss
          mockRedisGet.mockResolvedValueOnce(null);
          const result2 = await getCachedAIResponse(query, channelId, topK2);
          expect(result2).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property Test: Cache operations are idempotent
   * 
   * Caching the same response multiple times should not cause errors
   * and should result in the same cached value.
   */
  it("should allow idempotent caching of responses", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          query: fc.string({ minLength: 5, maxLength: 100 }),
          channelId: fc.uuid(),
          topK: fc.integer({ min: 1, max: 10 }),
          answer: fc.string({ minLength: 10, maxLength: 500 }),
          cacheCount: fc.integer({ min: 2, max: 5 }),
        }),
        async ({ query, channelId, topK, answer, cacheCount }) => {
          // Reset mocks for each iteration
          mockRedisSetex.mockClear();

          const response = {
            answer,
            context: "Test context",
            sources: 1,
            timestamp: new Date().toISOString(),
          };

          // Cache the response multiple times
          for (let i = 0; i < cacheCount; i++) {
            await cacheAIResponse(query, channelId, response, topK);
          }

          // Assert: setex was called exactly cacheCount times
          expect(mockRedisSetex).toHaveBeenCalledTimes(cacheCount);

          // All calls should have the same cache key
          const calls = mockRedisSetex.mock.calls;
          const firstKey = calls[0][0];
          for (const call of calls) {
            expect(call[0]).toBe(firstKey);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
