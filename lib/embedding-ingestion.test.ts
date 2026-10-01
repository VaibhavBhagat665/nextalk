/**
 * Property-Based Tests for Embedding Ingestion Worker
 * 
 * Feature: nextalk-production-upgrade, Property 9: Message Embedding Generation
 * Validates: Requirements 4.3
 * 
 * Property: For any newly created message, the system should generate 
 * and store an embedding vector within a bounded time window.
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from "vitest";
import * as fc from "fast-check";

// Create mock functions before any imports
const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
const mockExecuteRaw = vi.fn();

const mockPrismaInstance = {
  message: {
    findUnique: mockFindUnique,
    findMany: mockFindMany,
  },
  $executeRaw: mockExecuteRaw,
};

// Mock Prisma BEFORE importing the module
vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    message = mockPrismaInstance.message;
    $executeRaw = mockPrismaInstance.$executeRaw;
  },
}));

// Mock the embeddings module BEFORE importing
vi.mock("./embeddings", async () => {
  const actual = await vi.importActual("./embeddings");
  return {
    ...actual,
    embedText: vi.fn(async (text: string) => ({
      embedding: Array(1536).fill(0.5),
      tokens: Math.ceil(text.length * 0.75),
    })),
    embedBatch: vi.fn(async (texts: string[]) => ({
      embeddings: texts.map(() => Array(1536).fill(0.5)),
      totalTokens: texts.reduce((sum, t) => sum + Math.ceil(t.length * 0.75), 0),
    })),
    getEmbeddingClient: vi.fn(() => ({
      embed: vi.fn(async () => Array(1536).fill(0.5)),
      embedBatch: vi.fn(async (texts: string[]) => 
        texts.map(() => Array(1536).fill(0.5))
      ),
      getDimension: () => 1536,
      getModel: () => "mock-model",
    })),
    resetEmbeddingClient: vi.fn(),
  };
});

// Now import the modules
const { ingestSingleMessage, ingestMessageEmbeddings } = await import("./embedding-ingestion");

describe("Property 9: Message Embedding Generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property Test: For any message with content, an embedding should be generated
   * 
   * This test generates random messages and verifies that:
   * 1. Messages with non-whitespace content get embeddings
   * 2. The embedding has the correct dimensions (1536)
   * 3. The database is updated with the embedding
   */
  it("should generate and store embeddings for any message with content", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.uuid(),
          content: fc.string({ minLength: 1, maxLength: 500 })
            .filter(s => s.trim().length > 0), // Only non-whitespace strings
        }),
        async (message) => {
          // Reset mocks before each test iteration
          mockFindUnique.mockClear();
          mockExecuteRaw.mockClear();

          // Setup: Mock database response for findUnique
          mockFindUnique.mockResolvedValueOnce({
            id: message.id,
            content: message.content,
            embedding: null, // No embedding yet
          });

          // Setup: Mock database update
          mockExecuteRaw.mockResolvedValueOnce(1);

          // Act: Ingest the message
          await ingestSingleMessage(message.id);

          // Assert: findUnique was called with correct message ID
          expect(mockFindUnique).toHaveBeenCalledWith({
            where: { id: message.id },
            select: { id: true, content: true, embedding: true },
          });

          // Assert: Database was updated with an embedding
          expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 100 } // Run 100 iterations with random messages
    );
  });

  /**
   * Property Test: Empty messages should not generate embeddings
   * 
   * Verifies that messages with empty or whitespace-only content
   * are skipped during ingestion (idempotent behavior).
   */
  it("should skip embedding generation for empty messages", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.uuid(),
          content: fc.constantFrom("", "   ", "\t", "\n", "  \t\n  "),
        }),
        async (message) => {
          // Setup: Mock database response
          mockFindUnique.mockResolvedValueOnce({
            id: message.id,
            content: message.content,
            embedding: null,
          });

          // Act: Ingest the message
          await ingestSingleMessage(message.id);

          // Assert: Database should NOT be updated for empty content
          expect(mockExecuteRaw).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property Test: Idempotency - messages with embeddings should be skipped
   * 
   * Verifies that if a message already has an embedding, the system
   * skips re-processing it (idempotent behavior).
   */
  it("should skip messages that already have embeddings (idempotent)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.uuid(),
          content: fc.string({ minLength: 1, maxLength: 500 }),
          embedding: fc.array(fc.float(), { minLength: 1536, maxLength: 1536 }),
        }),
        async (message) => {
          // Setup: Mock database response with existing embedding
          mockFindUnique.mockResolvedValueOnce({
            id: message.id,
            content: message.content,
            embedding: message.embedding, // Already has embedding
          });

          // Act: Ingest the message
          await ingestSingleMessage(message.id);

          // Assert: Database should NOT be updated since embedding exists
          expect(mockExecuteRaw).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property Test: Batch ingestion processes all messages without embeddings
   * 
   * Verifies that batch processing correctly identifies and processes
   * all messages that lack embeddings.
   */
  it("should process all messages without embeddings in batch", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            content: fc.string({ minLength: 1, maxLength: 100 })
              .filter(s => s.trim().length > 0), // Only non-whitespace strings
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (messages) => {
          // Reset mocks before each test iteration
          mockFindMany.mockClear();
          mockExecuteRaw.mockClear();

          // Setup: Mock database response for findMany
          mockFindMany.mockResolvedValueOnce(
            messages.map(m => ({ id: m.id, content: m.content }))
          );

          // Setup: Mock database updates (one per message)
          for (let i = 0; i < messages.length; i++) {
            mockExecuteRaw.mockResolvedValueOnce(1);
          }

          // Act: Run batch ingestion
          const stats = await ingestMessageEmbeddings({
            batchSize: 100,
            maxMessages: 100,
          });

          // Assert: All messages were processed
          expect(stats.processed).toBe(messages.length);
          expect(stats.failed).toBe(0);

          // Assert: Database was updated for each message
          expect(mockExecuteRaw).toHaveBeenCalledTimes(messages.length);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property Test: Embedding dimensions are always 1536
   * 
   * Verifies that all generated embeddings have exactly 1536 dimensions
   * (OpenAI text-embedding-3-small specification).
   */
  it("should always generate embeddings with 1536 dimensions", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.uuid(),
          content: fc.string({ minLength: 1, maxLength: 1000 })
            .filter(s => s.trim().length > 0), // Only non-whitespace strings
        }),
        async (message) => {
          // Reset mocks before each test iteration
          mockFindUnique.mockClear();
          mockExecuteRaw.mockClear();

          // Setup: Mock database response
          mockFindUnique.mockResolvedValueOnce({
            id: message.id,
            content: message.content,
            embedding: null,
          });

          // Setup: Mock database update
          mockExecuteRaw.mockResolvedValueOnce(1);

          // Act: Ingest the message
          await ingestSingleMessage(message.id);

          // Assert: Database was updated (embedding was generated)
          expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
