/**
 * Unit tests for Embedding Service
 * 
 * Tests the embedding API client implementation including:
 * - OpenAI embedding client functionality
 * - Batch processing
 * - Retry logic
 * - Rate limiting
 * - Mock client for testing
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  OpenAIEmbeddingClient,
  MockEmbeddingClient,
  RateLimiter,
  BatchedEmbeddingClient,
  embedText,
  embedBatch,
  estimateCost,
} from "./embeddings";

describe("MockEmbeddingClient", () => {
  let client: MockEmbeddingClient;

  beforeEach(() => {
    client = new MockEmbeddingClient(1536);
  });

  it("should generate embeddings with correct dimensions", async () => {
    const embedding = await client.embed("test text");
    expect(embedding).toHaveLength(1536);
  });

  it("should generate normalized embeddings", async () => {
    const embedding = await client.embed("test text");
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );
    expect(magnitude).toBeCloseTo(1.0, 5);
  });

  it("should generate deterministic embeddings for same text", async () => {
    const embedding1 = await client.embed("hello world");
    const embedding2 = await client.embed("hello world");
    expect(embedding1).toEqual(embedding2);
  });

  it("should generate different embeddings for different text", async () => {
    const embedding1 = await client.embed("hello");
    const embedding2 = await client.embed("world");
    expect(embedding1).not.toEqual(embedding2);
  });

  it("should handle batch embedding", async () => {
    const texts = ["text1", "text2", "text3"];
    const embeddings = await client.embedBatch(texts);
    
    expect(embeddings).toHaveLength(3);
    embeddings.forEach((emb) => {
      expect(emb).toHaveLength(1536);
    });
  });
});

describe("RateLimiter", () => {
  it("should allow immediate token consumption when available", async () => {
    const limiter = new RateLimiter(10, 10); // 10 tokens, refill 10/sec
    
    const start = Date.now();
    await limiter.waitForToken(5);
    const elapsed = Date.now() - start;
    
    expect(elapsed).toBeLessThan(100); // Should be immediate
  });

  it("should wait when tokens are exhausted", async () => {
    const limiter = new RateLimiter(5, 10); // 5 tokens, refill 10/sec
    
    // Consume all tokens
    await limiter.waitForToken(5);
    
    // Next request should wait
    const start = Date.now();
    await limiter.waitForToken(5);
    const elapsed = Date.now() - start;
    
    expect(elapsed).toBeGreaterThanOrEqual(400); // Should wait ~500ms
  });
});

describe("BatchedEmbeddingClient", () => {
  it("should split large requests into batches", async () => {
    const mockClient = new MockEmbeddingClient(1536);
    const batchedClient = new BatchedEmbeddingClient(mockClient, {
      batchSize: 10,
    });

    const texts = Array.from({ length: 25 }, (_, i) => `text ${i}`);
    const embeddings = await batchedClient.embedAll(texts);

    expect(embeddings).toHaveLength(25);
    embeddings.forEach((emb) => {
      expect(emb).toHaveLength(1536);
    });
  });
});

describe("Helper Functions", () => {
  it("should estimate cost correctly", () => {
    // $0.02 per 1M tokens
    const cost1M = estimateCost(1_000_000);
    expect(cost1M).toBeCloseTo(0.02, 5);

    const cost100k = estimateCost(100_000);
    expect(cost100k).toBeCloseTo(0.002, 5);
  });
});

describe("OpenAIEmbeddingClient", () => {
  it("should validate batch size limit", async () => {
    const client = new OpenAIEmbeddingClient("fake-key");
    const texts = Array.from({ length: 101 }, (_, i) => `text ${i}`);

    await expect(client.embedBatch(texts)).rejects.toThrow(
      "Batch size 101 exceeds maximum of 100"
    );
  });

  it("should handle empty texts by returning zero vectors", async () => {
    const client = new OpenAIEmbeddingClient("fake-key");
    
    // Mock fetch to avoid real API calls
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ embedding: Array(1536).fill(0.5) }],
      }),
    });

    const embeddings = await client.embedBatch(["valid text", "", "  "]);
    
    expect(embeddings).toHaveLength(3);
    expect(embeddings[0]).not.toEqual(Array(1536).fill(0));
    expect(embeddings[1]).toEqual(Array(1536).fill(0));
    expect(embeddings[2]).toEqual(Array(1536).fill(0));
  });
});
