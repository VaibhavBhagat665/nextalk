/**
 * Property-Based Tests for RAG Context Retrieval
 * 
 * Feature: nextalk-production-upgrade, Property 11: RAG Context Retrieval
 * Validates: Requirements 4.6
 * 
 * Property: For any AI Co-Pilot query, the system should retrieve relevant 
 * message context via semantic search before generating the response, and 
 * the response should reference or incorporate the retrieved context.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fc from "fast-check";

// Create mock functions before any imports
const mockQueryRawUnsafe = vi.fn();
const mockFindUnique = vi.fn();
const mockFindFirst = vi.fn();

const mockPrismaInstance = {
  $queryRawUnsafe: mockQueryRawUnsafe,
  message: {
    findUnique: mockFindUnique,
    findFirst: mockFindFirst,
  },
};

// Mock Prisma BEFORE importing the module
vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    $queryRawUnsafe = mockPrismaInstance.$queryRawUnsafe;
    message = mockPrismaInstance.message;
  },
}));

// Mock the embeddings module
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
const { retrieveContext } = await import("./semantic-search");

describe("Property 11: RAG Context Retrieval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property Test: RAG retrieval always performs semantic search before formatting context
   * 
   * This test verifies that for any query and channel:
   * 1. The system performs semantic search to retrieve relevant messages
   * 2. The retrieved messages are formatted as context string
   * 3. The context string is ready for LLM consumption
   */
  it("should retrieve relevant context via semantic search for any query", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random query string
        fc.string({ minLength: 3, maxLength: 200 }),
        
        // Generate random channel ID
        fc.uuid(),
        
        // Generate random topK between 1 and 10
        fc.integer({ min: 1, max: 10 }),
        
        // Generate random number of results (0-20, may be less than topK)
        fc.integer({ min: 0, max: 20 }),
        
        async (query, channelId, topK, numResults) => {
          // Skip empty queries after trim
          if (query.trim().length === 0) {
            return true;
          }

          // Reset mocks
          mockQueryRawUnsafe.mockClear();

          // Generate mock semantic search results
          const actualResults = Math.min(numResults, topK);
          const mockResults = Array.from({ length: actualResults }, (_, i) => ({
            id: `msg-${i}`,
            content: `Test message content ${i}: ${query.substring(0, 20)}`,
            channelId: channelId,
            userId: `user-${i}`,
            createdAt: new Date(Date.now() - i * 3600000), // Hours ago
            similarity: 0.6 + (Math.random() * 0.4), // 0.6 to 1.0
            user: {
              id: `user-${i}`,
              username: `testuser${i}`,
              imageUrl: null,
            },
          }));

          // Sort by similarity descending
          mockResults.sort((a, b) => b.similarity - a.similarity);

          // Setup: Mock database response
          mockQueryRawUnsafe.mockResolvedValueOnce(mockResults);

          // Execute retrieveContext
          const context = await retrieveContext(query, channelId, topK);

          // Property 1: If results exist, context should be a formatted string
          if (actualResults > 0) {
            expect(context).not.toBe("No relevant context found.");
            expect(context).not.toBe("Error retrieving context.");
            expect(typeof context).toBe("string");
            expect(context.length).toBeGreaterThan(0);

            // Property 2: Context should contain numbered entries [1], [2], etc.
            const lines = context.split("\n\n");
            expect(lines.length).toBeGreaterThan(0);
            expect(lines.length).toBeLessThanOrEqual(actualResults);

            // Property 3: Each entry should have format: [N] username (date): content
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              // Check for numbered format [1], [2], etc.
              expect(line).toMatch(/^\[\d+\]/);
              // Check for username
              expect(line).toMatch(/testuser\d+/);
              // Check for colon separator
              expect(line).toContain(":");
            }

            // Property 4: Context should include all usernames and content from search results
            // Each username and content should appear at least once in the context
            for (const result of mockResults.slice(0, topK)) {
              // The username should appear somewhere in the context
              expect(context).toContain(result.user.username);
              // The content should appear somewhere in the context
              expect(context).toContain(result.content);
            }
          } else {
            // Property 5: If no results, should return empty context message
            expect(context).toBe("No relevant context found.");
          }

          // Property 6: Semantic search should have been called with correct parameters
          expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(1);

          return true;
        }
      ),
      { numRuns: 100 } // Run 100 test iterations as specified in design doc
    );
  });

  /**
   * Property Test: Context format is consistent and parseable
   * 
   * This test verifies that the formatted context string:
   * 1. Uses consistent formatting for all messages
   * 2. Can be reliably parsed by the LLM
   * 3. Contains all required information (user, date, content)
   */
  it("should format context consistently with required information", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random query
        fc.string({ minLength: 3, maxLength: 100 }),
        
        // Generate random channel ID
        fc.uuid(),
        
        // Generate random number of results (at least 1 to test formatting)
        fc.integer({ min: 1, max: 10 }),
        
        async (query, channelId, numResults) => {
          // Skip empty queries
          if (query.trim().length === 0) {
            return true;
          }

          // Reset mocks
          mockQueryRawUnsafe.mockClear();

          // Generate mock results with varying dates
          const mockResults = Array.from({ length: numResults }, (_, i) => {
            const daysAgo = Math.floor(Math.random() * 30); // 0-30 days ago
            const date = new Date(Date.now() - daysAgo * 24 * 3600000);
            
            return {
              id: `msg-${i}`,
              content: `Message ${i} with query context: ${query}`,
              channelId: channelId,
              userId: `user-${i}`,
              createdAt: date,
              similarity: 0.7 + (Math.random() * 0.3),
              user: {
                id: `user-${i}`,
                username: `user_${i}`,
                imageUrl: null,
              },
            };
          });

          // Sort by similarity descending
          mockResults.sort((a, b) => b.similarity - a.similarity);

          mockQueryRawUnsafe.mockResolvedValueOnce(mockResults);

          // Execute retrieveContext
          const context = await retrieveContext(query, channelId);

          // Property 1: Context should be non-empty
          expect(context).not.toBe("No relevant context found.");
          expect(context.length).toBeGreaterThan(0);

          // Property 2: Split by double newline should yield separate messages
          const messages = context.split("\n\n");
          expect(messages.length).toBe(numResults);

          // Property 3: Each message should have consistent format
          for (let i = 0; i < messages.length; i++) {
            const message = messages[i];
            
            // Should start with [N] where N is i+1
            expect(message).toMatch(new RegExp(`^\\[${i + 1}\\]`));
            
            // Should contain a username (user_0, user_1, etc.) - not necessarily user_i since results are sorted
            expect(message).toMatch(/user_\d+/);
            
            // Should contain date in parentheses
            expect(message).toMatch(/\([^)]+\)/);
            
            // Should contain colon separator
            expect(message).toContain(":");
            
            // Should contain "Message" followed by a number
            expect(message).toMatch(/Message \d+/);
          }

          // Property 4: Date formatting should be human-readable
          for (const message of messages) {
            // Extract date portion (between parentheses)
            const dateMatch = message.match(/\(([^)]+)\)/);
            expect(dateMatch).not.toBeNull();
            
            if (dateMatch) {
              const dateStr = dateMatch[1];
              // Date should be one of: "today", "yesterday", "N days ago", or a date string
              const isValidFormat = 
                dateStr === "today" ||
                dateStr === "yesterday" ||
                /^\d+ days ago$/.test(dateStr) ||
                /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr); // M/D/YYYY format
              
              expect(isValidFormat).toBe(true);
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Context retrieval uses appropriate similarity threshold
   * 
   * This test verifies that RAG context retrieval uses a lower similarity
   * threshold (0.6) compared to regular semantic search (0.7) to ensure
   * more context is retrieved for the LLM.
   */
  it("should use lower similarity threshold (0.6) for RAG context retrieval", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random query
        fc.string({ minLength: 5, maxLength: 150 }),
        
        // Generate random channel ID
        fc.uuid(),
        
        async (query, channelId) => {
          // Skip empty queries
          if (query.trim().length === 0) {
            return true;
          }

          // Reset mocks
          mockQueryRawUnsafe.mockClear();

          // Generate results with similarities just above 0.6 but below 0.7
          const mockResults = [
            {
              id: "msg-1",
              content: "Borderline relevant message",
              channelId: channelId,
              userId: "user-1",
              createdAt: new Date(),
              similarity: 0.65, // Above RAG threshold (0.6), below regular threshold (0.7)
              user: {
                id: "user-1",
                username: "testuser",
                imageUrl: null,
              },
            },
          ];

          mockQueryRawUnsafe.mockResolvedValueOnce(mockResults);

          // Execute retrieveContext
          const context = await retrieveContext(query, channelId);

          // Property: Should include results with similarity >= 0.6
          if (mockResults.length > 0) {
            expect(context).not.toBe("No relevant context found.");
            // Verify the SQL query used threshold of 0.6
            expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(1);
            const sqlQuery = mockQueryRawUnsafe.mock.calls[0][0] as string;
            expect(sqlQuery).toContain("0.6"); // Lower threshold for RAG
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Empty results are handled gracefully
   * 
   * This test verifies that when no relevant messages are found,
   * the system returns an appropriate message rather than failing.
   */
  it("should return appropriate message when no relevant context found", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random query
        fc.string({ minLength: 3, maxLength: 100 }),
        
        // Generate random channel ID
        fc.uuid(),
        
        async (query, channelId) => {
          // Skip empty queries
          if (query.trim().length === 0) {
            return true;
          }

          // Reset mocks
          mockQueryRawUnsafe.mockClear();

          // Mock empty results (no messages above similarity threshold)
          mockQueryRawUnsafe.mockResolvedValueOnce([]);

          // Execute retrieveContext
          const context = await retrieveContext(query, channelId);

          // Property: Should return specific empty context message
          expect(context).toBe("No relevant context found.");

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Error handling returns safe fallback
   * 
   * This test verifies that if semantic search fails,
   * the system returns an error message rather than throwing.
   */
  it("should return error message when retrieval fails", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random query
        fc.string({ minLength: 3, maxLength: 100 }),
        
        // Generate random channel ID
        fc.uuid(),
        
        async (query, channelId) => {
          // Skip empty queries
          if (query.trim().length === 0) {
            return true;
          }

          // Reset mocks
          mockQueryRawUnsafe.mockClear();

          // Mock database error
          mockQueryRawUnsafe.mockRejectedValueOnce(new Error("Database connection failed"));

          // Execute retrieveContext
          const context = await retrieveContext(query, channelId);

          // Property: Should return error message, not throw
          expect(context).toBe("Error retrieving context.");

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: TopK parameter controls number of retrieved messages
   * 
   * This test verifies that the topK parameter correctly limits
   * the number of messages retrieved and formatted.
   */
  it("should respect topK parameter and retrieve at most topK messages", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random query
        fc.string({ minLength: 3, maxLength: 100 }),
        
        // Generate random channel ID
        fc.uuid(),
        
        // Generate random topK between 1 and 20
        fc.integer({ min: 1, max: 20 }),
        
        // Generate more results than topK to test limiting
        fc.integer({ min: 5, max: 50 }),
        
        async (query, channelId, topK, availableResults) => {
          // Skip empty queries
          if (query.trim().length === 0) {
            return true;
          }

          // Reset mocks
          mockQueryRawUnsafe.mockClear();

          // Generate many results (database will limit via LIMIT clause)
          const actualResults = Math.min(availableResults, topK);
          const mockResults = Array.from({ length: actualResults }, (_, i) => ({
            id: `msg-${i}`,
            content: `Message ${i}`,
            channelId: channelId,
            userId: `user-${i}`,
            createdAt: new Date(Date.now() - i * 3600000),
            similarity: 0.9 - (i * 0.01), // Descending similarities
            user: {
              id: `user-${i}`,
              username: `user${i}`,
              imageUrl: null,
            },
          }));

          mockQueryRawUnsafe.mockResolvedValueOnce(mockResults);

          // Execute retrieveContext with custom topK
          const context = await retrieveContext(query, channelId, topK);

          if (context !== "No relevant context found.") {
            // Property: Number of messages in context should not exceed topK
            const messages = context.split("\n\n");
            expect(messages.length).toBeLessThanOrEqual(topK);
            expect(messages.length).toBe(actualResults);

            // Property: Messages should be numbered sequentially from 1 to N
            for (let i = 0; i < messages.length; i++) {
              expect(messages[i]).toMatch(new RegExp(`^\\[${i + 1}\\]`));
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Context is ready for LLM consumption
   * 
   * This test verifies that the formatted context can be directly
   * inserted into an LLM prompt without additional processing.
   */
  it("should produce LLM-ready context that can be used in prompts", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random query
        fc.string({ minLength: 10, maxLength: 200 }),
        
        // Generate random channel ID
        fc.uuid(),
        
        // Generate random number of results
        fc.integer({ min: 1, max: 5 }),
        
        async (query, channelId, numResults) => {
          // Skip empty queries
          if (query.trim().length === 0) {
            return true;
          }

          // Reset mocks
          mockQueryRawUnsafe.mockClear();

          // Generate realistic chat messages
          const mockResults = Array.from({ length: numResults }, (_, i) => ({
            id: `msg-${i}`,
            content: `This is a realistic chat message discussing ${query.substring(0, 30)}`,
            channelId: channelId,
            userId: `user-${i}`,
            createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 3600000), // Within last week
            similarity: 0.8 + (Math.random() * 0.2),
            user: {
              id: `user-${i}`,
              username: `ChatUser${i}`,
              imageUrl: null,
            },
          }));

          mockResults.sort((a, b) => b.similarity - a.similarity);
          mockQueryRawUnsafe.mockResolvedValueOnce(mockResults);

          // Execute retrieveContext
          const context = await retrieveContext(query, channelId);

          if (context !== "No relevant context found.") {
            // Property 1: Context should be a valid string
            expect(typeof context).toBe("string");
            expect(context.length).toBeGreaterThan(0);

            // Property 2: Can be inserted into a prompt template
            const promptTemplate = `Context (relevant messages):

${context}

Question: ${query}`;
            
            expect(promptTemplate).toContain(context);
            expect(promptTemplate).toContain(query);
            
            // Property 3: Context should not contain problematic characters that would break prompts
            // No unmatched quotes, no control characters
            expect(context).not.toContain("\0");
            expect(context).not.toMatch(/[\x00-\x08\x0B\x0C\x0E-\x1F]/);

            // Property 4: Each message entry should be on its own "line" (separated by \n\n)
            const entries = context.split("\n\n");
            expect(entries.length).toBe(numResults);
            expect(entries.every(entry => entry.length > 0)).toBe(true);

            // Property 5: Context format matches expected RAG pattern
            // [1] username (date): content
            // [2] username (date): content
            for (const entry of entries) {
              expect(entry).toMatch(/^\[\d+\]\s+\w+\s+\([^)]+\):\s+.+$/);
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
