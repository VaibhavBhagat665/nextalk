/**
 * Message Caching Service using Redis
 * 
 * Implements hot-path caching for recent messages per channel to reduce database load.
 * Uses Redis with 5-minute TTL for frequently accessed channels.
 * 
 * Cache Strategy:
 * - Cache last 50 messages per channel
 * - 5-minute TTL (300 seconds)
 * - Invalidate on new message send
 * - Cache key format: `messages:channel:{channelId}`
 */

import Redis from "ioredis";

const REDIS_URL = process.env.UPSTASH_REDIS_URL;

// Lazy initialize Redis client
let redis: Redis | null = null;

function getRedisClient(): Redis | null {
  if (!REDIS_URL) {
    console.warn("⚠️  UPSTASH_REDIS_URL not configured, caching disabled");
    return null;
  }

  if (!redis) {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      lazyConnect: true,
    });

    redis.on("error", (err) => {
      console.error("Redis cache error:", err.message);
    });
  }

  return redis;
}

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  TTL: 300, // 5 minutes in seconds
  MAX_MESSAGES: 50, // Cache last 50 messages per channel
  KEY_PREFIX: "messages:channel:",
};

/**
 * Generate cache key for a channel
 */
function getCacheKey(channelId: string): string {
  return `${CACHE_CONFIG.KEY_PREFIX}${channelId}`;
}

/**
 * Get cached messages for a channel
 * Returns null if cache miss or Redis unavailable
 */
export async function getCachedMessages(channelId: string): Promise<any[] | null> {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const key = getCacheKey(channelId);
    const cached = await client.get(key);

    if (!cached) {
      return null;
    }

    const messages = JSON.parse(cached);
    console.log(`✅ Cache HIT for channel:${channelId} (${messages.length} messages)`);
    return messages;
  } catch (error: any) {
    console.error(`Cache read error for channel:${channelId}:`, error.message);
    return null;
  }
}

/**
 * Set cached messages for a channel
 * Stores last N messages with TTL
 */
export async function setCachedMessages(
  channelId: string,
  messages: any[]
): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    const key = getCacheKey(channelId);
    
    // Only cache the most recent messages
    const messagesToCache = messages.slice(0, CACHE_CONFIG.MAX_MESSAGES);
    
    // Store with TTL
    await client.setex(
      key,
      CACHE_CONFIG.TTL,
      JSON.stringify(messagesToCache)
    );

    console.log(`✅ Cache SET for channel:${channelId} (${messagesToCache.length} messages, TTL: ${CACHE_CONFIG.TTL}s)`);
  } catch (error: any) {
    console.error(`Cache write error for channel:${channelId}:`, error.message);
  }
}

/**
 * Invalidate cache for a channel
 * Called when a new message is sent to ensure fresh data
 */
export async function invalidateChannelCache(channelId: string): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    const key = getCacheKey(channelId);
    await client.del(key);
    console.log(`🗑️  Cache INVALIDATED for channel:${channelId}`);
  } catch (error: any) {
    console.error(`Cache invalidation error for channel:${channelId}:`, error.message);
  }
}

/**
 * Invalidate multiple channel caches at once
 * Useful for bulk operations
 */
export async function invalidateMultipleChannels(channelIds: string[]): Promise<void> {
  const client = getRedisClient();
  if (!client || channelIds.length === 0) return;

  try {
    const keys = channelIds.map(getCacheKey);
    await client.del(...keys);
    console.log(`🗑️  Cache INVALIDATED for ${channelIds.length} channels`);
  } catch (error: any) {
    console.error(`Bulk cache invalidation error:`, error.message);
  }
}

/**
 * Get cache statistics for monitoring
 */
export async function getCacheStats(): Promise<{
  enabled: boolean;
  keysCount: number;
  memoryUsage?: string;
} | null> {
  const client = getRedisClient();
  if (!client) {
    return { enabled: false, keysCount: 0 };
  }

  try {
    // Count keys matching our pattern
    const keys = await client.keys(`${CACHE_CONFIG.KEY_PREFIX}*`);
    
    // Get memory usage info (if available)
    let memoryUsage: string | undefined;
    try {
      const info = await client.info("memory");
      const match = info.match(/used_memory_human:(.*)/);
      memoryUsage = match ? match[1] : undefined;
    } catch {
      // Memory info not available
    }

    return {
      enabled: true,
      keysCount: keys.length,
      memoryUsage,
    };
  } catch (error: any) {
    console.error("Cache stats error:", error.message);
    return null;
  }
}

/**
 * Warm up cache for a specific channel
 * Useful for pre-loading frequently accessed channels
 */
export async function warmUpCache(
  channelId: string,
  messages: any[]
): Promise<void> {
  await setCachedMessages(channelId, messages);
}

/**
 * Clear all message caches
 * Use with caution - for maintenance/debugging only
 */
export async function clearAllCaches(): Promise<number> {
  const client = getRedisClient();
  if (!client) return 0;

  try {
    const keys = await client.keys(`${CACHE_CONFIG.KEY_PREFIX}*`);
    if (keys.length === 0) return 0;

    const deleted = await client.del(...keys);
    console.log(`🗑️  Cleared ${deleted} cache entries`);
    return deleted;
  } catch (error: any) {
    console.error("Clear all caches error:", error.message);
    return 0;
  }
}

/**
 * Cache middleware for message queries
 * Wraps database query with cache read/write
 */
export async function withCache<T>(
  channelId: string,
  fetchFn: () => Promise<T>
): Promise<T> {
  // Try cache first
  const cached = await getCachedMessages(channelId);
  if (cached !== null) {
    return cached as T;
  }

  // Cache miss - fetch from database
  const data = await fetchFn();

  // Store in cache for next time
  if (Array.isArray(data)) {
    await setCachedMessages(channelId, data);
  }

  return data;
}

/**
 * Export cache configuration for testing
 */
export const __CACHE_CONFIG__ = CACHE_CONFIG;
