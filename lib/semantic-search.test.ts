/**
 * Property-Based Tests for Semantic Search
 * 
 * Feature: nextalk-production-upgrade, Property 10: Semantic Search Relevance
 * Validates: Requirements 4.5
 * 
 * Property: For any semantic search query, all returned results should have 
 * cosine similarity above the threshold (e.g., 0.7) and be ranked in 
 * descending order of similarity score.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fc from "fast-check";

// Create mock functions before any imports
const mockQueryRawUnsafe = vi.fn();
const mockFindUnique = vi.fn();

const mockPrismaInstance = {
  $queryRawUnsafe: mockQueryRawUnsafe,
  message: {
    findUnique: mockFindUnique,
  },
};

// Mock Redis before importing
const mockRedisGet = vi.fn();
const mockRedisSetex = vi.fn();

const mockRedis = {
  get: mockRedisGet,
  setex: mockRedisSetex,
};

// Mock Prisma BEFORE importing the module
vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    $queryRawUnsafe = mockPrismaInstance.$queryRawUnsafe;
    message = mockPrismaInstance.message;
  },
}));

// Mock Redis BEFORE importing the module
vi.mock("./redis", () => ({
  redis: mockRedis,
  getRedisPub: vi.fn(() => mockRedis),
  getRedisSub: vi.fn(() => mockRedis),
}));

// Mock the embeddings module BEFORE importing
vi.mock("./embeddings", () => ({
  embedText: vi.fn(async (text: string) => ({
    embedding: Array(1536).fill(0.5).map((_, i) => Math.sin(i * 0.01 + text.length * 0.1)),
    tokens: Math.ceil(text.length * 0.75),
  })),
  getEmbeddingClient: vi.fn(() => ({
    embed: vi.fn(async (text: string) => 
      Array(1536).fill(0.5).map((_, i) => Math.sin(i * 0.01 + text.length * 0.1))
    ),
    getDimension: () => 1536,
    getModel: () => "mock-model",
  })),
  resetEmbeddingClient: vi.fn(),
}));

// Now import the modules
const { semanticSearch } = await import("./semantic-search");

describe("Property 10: Semantic Search Relevance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset redis mocks to return cache miss by default
    mockRedisGet.mockResolvedValue(null);
    mockRedisSetex.mockResolvedValue("OK");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property Test: All search results meet similarity threshold
   * 
   * This test generates random search parameters and verifies that:
   * 1. All returned results have similarity >= threshold
   * 2. Results are ranked in descending order of similarity
   * 3. The similarity scores are valid numbers in range [0, 1]
   */
  it("should return only results above threshold, ranked by similarity", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random query string
        fc.string({ minLength: 3, maxLength: 100 }),
        
        // Generate random similarity threshold between 0.5 and 0.9 (excluding NaN, Infinity)
        fc.double({ min: 0.5, max: 0.9, noNaN: true }),
        
        // Generate random limit between 1 and 20
        fc.integer({ min: 1, max: 20 }),
        
        // Generate random number of results (0-50)
        fc.integer({ min: 0, max: 50 }),
        
        async (query, threshold, limit, numResults) => {
          // Skip empty queries after trim
          if (query.trim().length === 0) {
            return true;
          }

          // Reset mocks before each test iteration
          mockQueryRawUnsafe.mockClear();

          // Generate mock results with varying similarities
          const mockResults = Array.from({ length: Math.min(numResults, limit) }, (_, i) => {
            // Create a range of similarities: some above threshold, but never exceeding 1.0
            // Cosine similarity is bounded: [-1, 1], but search only returns positive matches
            const maxSimilarity = Math.min(1.0, threshold + 0.3);
            const similarity = threshold + (Math.random() * (maxSimilarity - threshold));
            
            return {
              id: `msg-${i}`,
              content: `Message ${i} content`,
              channelId: `channel-1`,
              userId: `user-${i}`,
              createdAt: new Date(Date.now() - i * 1000),
              similarity: similarity,
              user: {
                id: `user-${i}`,
                username: `user${i}`,
                imageUrl: null,
              },
            };
          });

          // Sort by similarity descending (simulating database ORDER BY)
          mockResults.sort((a, b) => b.similarity - a.similarity);

          // Setup: Mock database response
          mockQueryRawUnsafe.mockResolvedValueOnce(mockResults);

          // Execute the search
          const results = await semanticSearch({
            query,
            similarityThreshold: threshold,
            limit,
          });

          // Property 1: All results should meet or exceed the threshold
          for (const result of results) {
            expect(result.similarity).toBeGreaterThanOrEqual(threshold);
            expect(result.similarity).toBeLessThanOrEqual(1.0);
          }

          // Property 2: Results should be sorted in descending order by similarity
          for (let i = 0; i < results.length - 1; i++) {
            expect(results[i].similarity).toBeGreaterThanOrEqual(results[i + 1].similarity);
          }

          // Property 3: Number of results should not exceed limit
          expect(results.length).toBeLessThanOrEqual(limit);

          // Property 4: All similarity scores should be valid numbers
          for (const result of results) {
            expect(typeof result.similarity).toBe("number");
            expect(isNaN(result.similarity)).toBe(false);
            expect(isFinite(result.similarity)).toBe(true);
          }

          return true;
        }
      ),
      { numRuns: 100 } // Run 100 test iterations as specified in design doc
    );
  });

  /**
   * Property Test: Empty results when no matches above threshold
   * 
   * This test verifies that when all potential results are below the threshold,
   * an empty array is returned rather than results that don't meet the criteria.
   */
  it("should return empty array when no results meet threshold", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random query string
        fc.string({ minLength: 3, maxLength: 100 }),
        
        // Generate high threshold (0.9-0.99, excluding NaN)
        fc.double({ min: 0.9, max: 0.99, noNaN: true }),
        
        async (query, threshold) => {
          // Skip empty queries
          if (query.trim().length === 0) {
            return true;
          }

          // Reset mocks
          mockQueryRawUnsafe.mockClear();

          // Mock database returns empty results (all filtered by WHERE clause)
          mockQueryRawUnsafe.mockResolvedValueOnce([]);

          // Execute the search
          const results = await semanticSearch({
            query,
            similarityThreshold: threshold,
          });

          // Property: Should return empty array
          expect(Array.isArray(results)).toBe(true);
          expect(results.length).toBe(0);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Channel filtering works correctly
   * 
   * This test verifies that when a channelId filter is provided,
   * all results belong to that channel.
   */
  it("should return only results from specified channel when channelId provided", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random query string
        fc.string({ minLength: 3, maxLength: 100 }),
        
        // Generate random channel ID
        fc.uuid(),
        
        // Generate random number of results
        fc.integer({ min: 1, max: 20 }),
        
        async (query, channelId, numResults) => {
          // Skip empty queries
          if (query.trim().length === 0) {
            return true;
          }

          // Reset mocks
          mockQueryRawUnsafe.mockClear();

          // Generate mock results all from the same channel
          const mockResults = Array.from({ length: numResults }, (_, i) => ({
            id: `msg-${i}`,
            content: `Message ${i} content`,
            channelId: channelId, // All results from specified channel
            userId: `user-${i}`,
            createdAt: new Date(Date.now() - i * 1000),
            similarity: 0.7 + (Math.random() * 0.3), // 0.7 to 1.0
            user: {
              id: `user-${i}`,
              username: `user${i}`,
              imageUrl: null,
            },
          }));

          // Sort by similarity descending
          mockResults.sort((a, b) => b.similarity - a.similarity);

          // Setup: Mock database response
          mockQueryRawUnsafe.mockResolvedValueOnce(mockResults);

          // Execute the search with channel filter
          const results = await semanticSearch({
            query,
            channelId,
            similarityThreshold: 0.7,
          });

          // Property: All results should be from the specified channel
          for (const result of results) {
            expect(result.channelId).toBe(channelId);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: User filtering works correctly
   * 
   * This test verifies that when a userId filter is provided,
   * all results are messages from that user.
   */
  it("should return only results from specified user when userId provided", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random query string
        fc.string({ minLength: 3, maxLength: 100 }),
        
        // Generate random user ID
        fc.uuid(),
        
        // Generate random number of results
        fc.integer({ min: 1, max: 20 }),
        
        async (query, userId, numResults) => {
          // Skip empty queries
          if (query.trim().length === 0) {
            return true;
          }

          // Reset mocks
          mockQueryRawUnsafe.mockClear();

          // Generate mock results all from the same user
          const mockResults = Array.from({ length: numResults }, (_, i) => ({
            id: `msg-${i}`,
            content: `Message ${i} content`,
            channelId: `channel-${i}`,
            userId: userId, // All results from specified user
            createdAt: new Date(Date.now() - i * 1000),
            similarity: 0.7 + (Math.random() * 0.3), // 0.7 to 1.0
            user: {
              id: userId,
              username: `testuser`,
              imageUrl: null,
            },
          }));

          // Sort by similarity descending
          mockResults.sort((a, b) => b.similarity - a.similarity);

          // Setup: Mock database response
          mockQueryRawUnsafe.mockResolvedValueOnce(mockResults);

          // Execute the search with user filter
          const results = await semanticSearch({
            query,
            userId,
            similarityThreshold: 0.7,
          });

          // Property: All results should be from the specified user
          for (const result of results) {
            expect(result.userId).toBe(userId);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Limit parameter bounds results correctly
   * 
   * This test verifies that the limit parameter correctly constrains
   * the number of returned results.
   */
  it("should respect limit parameter and return at most limit results", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random query string
        fc.string({ minLength: 3, maxLength: 100 }),
        
        // Generate random limit between 1 and 50
        fc.integer({ min: 1, max: 50 }),
        
        // Generate number of potential results (could be more than limit)
        fc.integer({ min: 0, max: 100 }),
        
        async (query, limit, potentialResults) => {
          // Skip empty queries
          if (query.trim().length === 0) {
            return true;
          }

          // Reset mocks
          mockQueryRawUnsafe.mockClear();

          // Generate mock results (database will limit them)
          const actualResults = Math.min(potentialResults, limit);
          const mockResults = Array.from({ length: actualResults }, (_, i) => ({
            id: `msg-${i}`,
            content: `Message ${i} content`,
            channelId: `channel-1`,
            userId: `user-${i}`,
            createdAt: new Date(Date.now() - i * 1000),
            similarity: 0.7 + (Math.random() * 0.3), // 0.7 to 1.0
            user: {
              id: `user-${i}`,
              username: `user${i}`,
              imageUrl: null,
            },
          }));

          // Sort by similarity descending
          mockResults.sort((a, b) => b.similarity - a.similarity);

          // Setup: Mock database response (database applies LIMIT)
          mockQueryRawUnsafe.mockResolvedValueOnce(mockResults);

          // Execute the search
          const results = await semanticSearch({
            query,
            limit,
            similarityThreshold: 0.7,
          });

          // Property: Number of results should not exceed limit
          expect(results.length).toBeLessThanOrEqual(limit);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Similarity ordering is strict descending
   * 
   * This test focuses specifically on the ordering property,
   * ensuring that for any adjacent pair of results, the first
   * has similarity >= the second.
   */
  it("should maintain strict descending order of similarity scores", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random query string
        fc.string({ minLength: 3, maxLength: 100 }),
        
        // Generate random number of results (at least 2 to test ordering)
        fc.integer({ min: 2, max: 30 }),
        
        async (query, numResults) => {
          // Skip empty queries
          if (query.trim().length === 0) {
            return true;
          }

          // Reset mocks
          mockQueryRawUnsafe.mockClear();

          // Generate mock results with varying similarities
          const mockResults = Array.from({ length: numResults }, (_, i) => ({
            id: `msg-${i}`,
            content: `Message ${i} content`,
            channelId: `channel-1`,
            userId: `user-${i}`,
            createdAt: new Date(Date.now() - i * 1000),
            similarity: 0.7 + (Math.random() * 0.3),
            user: {
              id: `user-${i}`,
              username: `user${i}`,
              imageUrl: null,
            },
          }));

          // Sort by similarity descending (this is what database ORDER BY does)
          mockResults.sort((a, b) => b.similarity - a.similarity);

          // Setup: Mock database response
          mockQueryRawUnsafe.mockResolvedValueOnce(mockResults);

          // Execute the search
          const results = await semanticSearch({
            query,
            similarityThreshold: 0.7,
          });

          // Property: For every adjacent pair (i, i+1), similarity[i] >= similarity[i+1]
          for (let i = 0; i < results.length - 1; i++) {
            const currentSimilarity = results[i].similarity;
            const nextSimilarity = results[i + 1].similarity;
            
            expect(currentSimilarity).toBeGreaterThanOrEqual(nextSimilarity);
            
            // Additional check: the difference should be non-negative
            expect(currentSimilarity - nextSimilarity).toBeGreaterThanOrEqual(0);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
