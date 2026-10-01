/**
 * AI Response Cache
 * 
 * Task 30.2: Implement AI response cache
 * Requirements: 4.8
 * Validates: Property 12 - AI Response Caching
 * 
 * Caches LLM responses for 24 hours to reduce API costs.
 * Uses query hash as key and invalidates on new relevant messages.
 */

import { createHash } from "crypto";
import { redis } from "./redis";

// Cache configuration
const AI_RESPONSE_TTL = 60 * 60 * 24; // 24 hours in seconds
const CACHE_KEY_PREFIX = "nextalk:ai:response:";

/**
 * Generate a deterministic hash from query parameters
 * This ensures the same query parameters always produce the same cache key
 */
export function generateQueryHash(query: string, channelId: string, topK: number = 5): string {
  // Normalize query: trim and lowercase for consistency
  const normalizedQuery = query.trim().toLowerCase();
  
  // Create hash from normalized query + channelId + topK
  const hash = createHash("sha256")
    .update(`${normalizedQuery}:${channelId}:${topK}`)
    .digest("hex");
  
  return hash.substring(0, 16); // Use first 16 chars for readability
}

/**
 * Get cache key for a query
 */
function getCacheKey(queryHash: string, channelId: string): string {
  return `${CACHE_KEY_PREFIX}${channelId}:${queryHash}`;
}

/**
 * Interface for cached AI response
 */
export interface CachedAIResponse {
  answer: string;
  context: string;
  sources: number;
  timestamp: string;
  cachedAt: string;
}

/**
 * Get cached AI response for a query
 * Returns null if not cached or expired
 */
export async function getCachedAIResponse(
  query: string,
  channelId: string,
  topK: number = 5
): Promise<CachedAIResponse | null> {
  try {
    const queryHash = generateQueryHash(query, channelId, topK);
    const cacheKey = getCacheKey(queryHash, channelId);
    
    const cached = await redis.get(cacheKey);
    
    if (!cached) {
      console.log(`💭 AI cache miss for query: "${query.substring(0, 50)}..."`);
      return null;
    }
    
    console.log(`✅ AI cache hit for query: "${query.substring(0, 50)}..."`);
    
    const parsed = JSON.parse(cached) as CachedAIResponse;
    return parsed;
  } catch (error: any) {
    console.error("❌ Failed to get cached AI response:", error.message);
    return null;
  }
}

/**
 * Cache an AI response
 */
export async function cacheAIResponse(
  query: string,
  channelId: string,
  response: Omit<CachedAIResponse, "cachedAt">,
  topK: number = 5
): Promise<void> {
  try {
    const queryHash = generateQueryHash(query, channelId, topK);
    const cacheKey = getCacheKey(queryHash, channelId);
    
    const cachedResponse: CachedAIResponse = {
      ...response,
      cachedAt: new Date().toISOString(),
    };
    
    await redis.setex(cacheKey, AI_RESPONSE_TTL, JSON.stringify(cachedResponse));
    
    console.log(`💾 AI response cached for 24h: "${query.substring(0, 50)}..."`);
  } catch (error: any) {
    console.error("❌ Failed to cache AI response:", error.message);
  }
}

/**
 * Invalidate all cached AI responses for a channel
 * Called when new messages are added to ensure freshness
 */
export async function invalidateChannelAICache(channelId: string): Promise<number> {
  try {
    const pattern = `${CACHE_KEY_PREFIX}${channelId}:*`;
    const keys = await redis.keys(pattern);
    
    if (keys.length === 0) {
      return 0;
    }
    
    // Delete all matching keys
    await redis.del(...keys);
    
    console.log(`🗑️ Invalidated ${keys.length} cached AI responses for channel ${channelId}`);
    
    return keys.length;
  } catch (error: any) {
    console.error("❌ Failed to invalidate channel AI cache:", error.message);
    return 0;
  }
}

/**
 * Get cache statistics for monitoring
 */
export async function getAICacheStats(): Promise<{
  totalKeys: number;
  memoryUsage: string;
}> {
  try {
    const keys = await redis.keys(`${CACHE_KEY_PREFIX}*`);
    
    // Get memory info (if available)
    let memoryUsage = "unknown";
    try {
      const info = await redis.info("memory");
      const match = info.match(/used_memory_human:(.+)/);
      if (match) {
        memoryUsage = match[1].trim();
      }
    } catch {
      // Info command might not be available in all Redis setups
    }
    
    return {
      totalKeys: keys.length,
      memoryUsage,
    };
  } catch (error: any) {
    console.error("❌ Failed to get AI cache stats:", error.message);
    return {
      totalKeys: 0,
      memoryUsage: "error",
    };
  }
}
