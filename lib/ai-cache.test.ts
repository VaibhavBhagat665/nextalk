/**
 * Tests for AI Response Cache
 * 
 * Task 30.2: Implement AI response cache
 * Requirements: 4.8
 * Validates: Property 12 - AI Response Caching
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock Redis before importing the module
vi.mock("./redis", () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
    keys: vi.fn(),
    del: vi.fn(),
    info: vi.fn(),
  },
}));

const { redis } = await import("./redis");
const {
  generateQueryHash,
  getCachedAIResponse,
  cacheAIResponse,
  invalidateChannelAICache,
  getAICacheStats,
} = await import("./ai-cache");

describe("AI Response Cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateQueryHash", () => {
    it("should generate consistent hashes for identical queries", () => {
      const query = "What was discussed about the project?";
      const channelId = "channel-123";
      const topK = 5;

      const hash1 = generateQueryHash(query, channelId, topK);
      const hash2 = generateQueryHash(query, channelId, topK);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(16); // First 16 chars of sha256
    });

    it("should normalize queries (case and whitespace insensitive)", () => {
      const channelId = "channel-123";
      const topK = 5;

      const hash1 = generateQueryHash("What was discussed?", channelId, topK);
      const hash2 = generateQueryHash("  WHAT WAS DISCUSSED?  ", channelId, topK);

      expect(hash1).toBe(hash2);
    });

    it("should generate different hashes for different queries", () => {
      const channelId = "channel-123";
      const topK = 5;

      const hash1 = generateQueryHash("Query A", channelId, topK);
      const hash2 = generateQueryHash("Query B", channelId, topK);

      expect(hash1).not.toBe(hash2);
    });

    it("should generate different hashes for different channels", () => {
      const query = "What was discussed?";
      const topK = 5;

      const hash1 = generateQueryHash(query, "channel-1", topK);
      const hash2 = generateQueryHash(query, "channel-2", topK);

      expect(hash1).not.toBe(hash2);
    });

    it("should generate different hashes for different topK values", () => {
      const query = "What was discussed?";
      const channelId = "channel-123";

      const hash1 = generateQueryHash(query, channelId, 5);
      const hash2 = generateQueryHash(query, channelId, 10);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("getCachedAIResponse", () => {
    it("should return null when cache miss", async () => {
      vi.mocked(redis.get).mockResolvedValue(null);

      const result = await getCachedAIResponse("test query", "channel-123", 5);

      expect(result).toBeNull();
      expect(redis.get).toHaveBeenCalledWith(
        expect.stringContaining("nextalk:ai:response:channel-123:")
      );
    });

    it("should return cached response when cache hit", async () => {
      const cachedData = {
        answer: "The team discussed project timelines.",
        context: "User A: We need to finish by Friday\nUser B: Agreed",
        sources: 2,
        timestamp: "2024-01-01T00:00:00.000Z",
        cachedAt: "2024-01-01T00:05:00.000Z",
      };

      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(cachedData));

      const result = await getCachedAIResponse("test query", "channel-123", 5);

      expect(result).toEqual(cachedData);
    });

    it("should return null on Redis error", async () => {
      vi.mocked(redis.get).mockRejectedValue(new Error("Redis connection failed"));

      const result = await getCachedAIResponse("test query", "channel-123", 5);

      expect(result).toBeNull();
    });
  });

  describe("cacheAIResponse", () => {
    it("should cache response with 24 hour TTL", async () => {
      const response = {
        answer: "The team discussed project timelines.",
        context: "User A: We need to finish by Friday",
        sources: 1,
        timestamp: "2024-01-01T00:00:00.000Z",
      };

      await cacheAIResponse("test query", "channel-123", response, 5);

      expect(redis.setex).toHaveBeenCalledWith(
        expect.stringContaining("nextalk:ai:response:channel-123:"),
        60 * 60 * 24, // 24 hours
        expect.stringContaining("The team discussed project timelines")
      );

      // Verify the cached data includes cachedAt timestamp
      const cachedData = JSON.parse(vi.mocked(redis.setex).mock.calls[0][2]);
      expect(cachedData).toHaveProperty("cachedAt");
      expect(cachedData.answer).toBe(response.answer);
    });

    it("should handle caching errors gracefully", async () => {
      vi.mocked(redis.setex).mockRejectedValue(new Error("Redis error"));

      const response = {
        answer: "Test answer",
        context: "Test context",
        sources: 1,
        timestamp: "2024-01-01T00:00:00.000Z",
      };

      // Should not throw
      await expect(
        cacheAIResponse("test query", "channel-123", response, 5)
      ).resolves.toBeUndefined();
    });
  });

  describe("invalidateChannelAICache", () => {
    it("should delete all cached responses for a channel", async () => {
      const keys = [
        "nextalk:ai:response:channel-123:abc123",
        "nextalk:ai:response:channel-123:def456",
        "nextalk:ai:response:channel-123:ghi789",
      ];

      vi.mocked(redis.keys).mockResolvedValue(keys);
      vi.mocked(redis.del).mockResolvedValue(keys.length);

      const deleted = await invalidateChannelAICache("channel-123");

      expect(deleted).toBe(3);
      expect(redis.keys).toHaveBeenCalledWith("nextalk:ai:response:channel-123:*");
      expect(redis.del).toHaveBeenCalledWith(...keys);
    });

    it("should return 0 when no cached responses exist", async () => {
      vi.mocked(redis.keys).mockResolvedValue([]);

      const deleted = await invalidateChannelAICache("channel-123");

      expect(deleted).toBe(0);
      expect(redis.del).not.toHaveBeenCalled();
    });

    it("should handle invalidation errors gracefully", async () => {
      vi.mocked(redis.keys).mockRejectedValue(new Error("Redis error"));

      const deleted = await invalidateChannelAICache("channel-123");

      expect(deleted).toBe(0);
    });
  });

  describe("getAICacheStats", () => {
    it("should return cache statistics", async () => {
      const keys = ["key1", "key2", "key3"];
      vi.mocked(redis.keys).mockResolvedValue(keys);
      vi.mocked(redis.info).mockResolvedValue("used_memory_human:2.50M\nother:data");

      const stats = await getAICacheStats();

      expect(stats.totalKeys).toBe(3);
      expect(stats.memoryUsage).toBe("2.50M");
    });

    it("should handle missing memory info", async () => {
      vi.mocked(redis.keys).mockResolvedValue(["key1"]);
      vi.mocked(redis.info).mockResolvedValue("no_memory_info_here");

      const stats = await getAICacheStats();

      expect(stats.totalKeys).toBe(1);
      expect(stats.memoryUsage).toBe("unknown");
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(redis.keys).mockRejectedValue(new Error("Redis error"));

      const stats = await getAICacheStats();

      expect(stats.totalKeys).toBe(0);
      expect(stats.memoryUsage).toBe("error");
    });
  });
});
