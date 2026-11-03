/**
 * Redis-based presence tracking service for horizontal scaling
 * 
 * Replaces in-memory Map<userId, UserPresence> with Redis hashes.
 * Enables presence tracking across multiple Socket.io server instances.
 * 
 * Architecture:
 * - Each user's presence stored as Redis hash: presence:user:{userId}
 * - All online users tracked in Redis set: presence:online
 * - Idle check runs on each server instance (redundant but safe)
 * - Presence updates broadcast via Socket.io Redis adapter
 */

import Redis from "ioredis";

export type PresenceStatus = "online" | "away" | "offline";

export interface UserPresence {
  socketId: string;
  username: string;
  imageUrl: string;
  status: PresenceStatus;
  lastActivity: number;
}

export class PresenceService {
  private redis: Redis;
  private instanceId: string;
  
  // Constants
  private readonly KEY_PREFIX = "presence:user:";
  private readonly ONLINE_SET = "presence:online";
  private readonly IDLE_THRESHOLD = 5 * 60 * 1000; // 5 minutes
  private readonly TTL = 60 * 60; // 1 hour - auto-cleanup if server crashes
  
  constructor(redisClient: Redis) {
    this.redis = redisClient;
    this.instanceId = `instance:${process.pid}:${Date.now()}`;
    console.log(`[PresenceService] Initialized with instance ID: ${this.instanceId}`);
  }

  /**
   * Mark user as online
   */
  async setOnline(
    userId: string,
    socketId: string,
    username: string,
    imageUrl: string
  ): Promise<void> {
    const key = this.KEY_PREFIX + userId;
    const presence: UserPresence = {
      socketId,
      username,
      imageUrl,
      status: "online",
      lastActivity: Date.now(),
    };

    await Promise.all([
      // Store user presence as hash
      this.redis.hmset(key, {
        socketId,
        username,
        imageUrl,
        status: "online",
        lastActivity: presence.lastActivity.toString(),
      }),
      // Set TTL for auto-cleanup
      this.redis.expire(key, this.TTL),
      // Add to online users set
      this.redis.sadd(this.ONLINE_SET, userId),
    ]);

    console.log(`[PresenceService] ${username} (${userId}) marked online`);
  }

  /**
   * Mark user as offline and remove from tracking
   */
  async setOffline(userId: string): Promise<void> {
    const key = this.KEY_PREFIX + userId;
    
    await Promise.all([
      // Delete presence hash
      this.redis.del(key),
      // Remove from online users set
      this.redis.srem(this.ONLINE_SET, userId),
    ]);

    console.log(`[PresenceService] User ${userId} marked offline`);
  }

  /**
   * Update user's last activity timestamp (resets away status)
   */
  async updateActivity(userId: string): Promise<void> {
    const key = this.KEY_PREFIX + userId;
    
    // Check if user exists first
    const exists = await this.redis.exists(key);
    if (!exists) {
      console.warn(`[PresenceService] Cannot update activity for unknown user: ${userId}`);
      return;
    }

    const now = Date.now();
    
    await Promise.all([
      this.redis.hset(key, "lastActivity", now.toString()),
      this.redis.hset(key, "status", "online"), // Reset to online if was away
      this.redis.expire(key, this.TTL), // Refresh TTL
    ]);
  }

  /**
   * Get a single user's presence
   */
  async getPresence(userId: string): Promise<UserPresence | null> {
    const key = this.KEY_PREFIX + userId;
    const data = await this.redis.hgetall(key);
    
    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return {
      socketId: data.socketId,
      username: data.username,
      imageUrl: data.imageUrl || "",
      status: data.status as PresenceStatus,
      lastActivity: parseInt(data.lastActivity, 10),
    };
  }

  /**
   * Get all online users
   */
  async getAllOnlineUsers(): Promise<Array<{ userId: string; presence: UserPresence }>> {
    const userIds = await this.redis.smembers(this.ONLINE_SET);
    
    if (userIds.length === 0) {
      return [];
    }

    // Fetch all presence data in parallel
    const presencePromises = userIds.map(async (userId) => {
      const presence = await this.getPresence(userId);
      return presence ? { userId, presence } : null;
    });

    const results = await Promise.all(presencePromises);
    
    // Filter out null values (users that were deleted between smembers and hgetall)
    return results.filter((r): r is { userId: string; presence: UserPresence } => r !== null);
  }

  /**
   * Check for idle users and update their status to "away"
   * Should be called periodically (e.g., every 30 seconds)
   * 
   * @returns Array of userIds whose status changed
   */
  async checkIdleUsers(): Promise<string[]> {
    const now = Date.now();
    const changedUsers: string[] = [];
    
    const onlineUsers = await this.getAllOnlineUsers();
    
    for (const { userId, presence } of onlineUsers) {
      const idleTime = now - presence.lastActivity;
      const shouldBeAway = idleTime > this.IDLE_THRESHOLD;
      
      // Update status if it changed
      if (shouldBeAway && presence.status === "online") {
        const key = this.KEY_PREFIX + userId;
        await this.redis.hset(key, "status", "away");
        changedUsers.push(userId);
        console.log(`[PresenceService] User ${userId} marked as away after ${Math.floor(idleTime / 1000)}s idle`);
      } else if (!shouldBeAway && presence.status === "away") {
        const key = this.KEY_PREFIX + userId;
        await this.redis.hset(key, "status", "online");
        changedUsers.push(userId);
        console.log(`[PresenceService] User ${userId} marked as online after activity`);
      }
    }
    
    return changedUsers;
  }

  /**
   * Get presence data for broadcasting to clients
   */
  async getBroadcastData(): Promise<Array<{
    userId: string;
    username: string;
    imageUrl: string;
    status: PresenceStatus;
  }>> {
    const onlineUsers = await this.getAllOnlineUsers();
    
    return onlineUsers.map(({ userId, presence }) => ({
      userId,
      username: presence.username,
      imageUrl: presence.imageUrl,
      status: presence.status,
    }));
  }

  /**
   * Cleanup stale presence data (optional maintenance)
   * Redis TTL handles most of this, but this is for explicit cleanup
   */
  async cleanupStaleUsers(maxAgeMs: number = 2 * 60 * 60 * 1000): Promise<number> {
    const now = Date.now();
    const onlineUsers = await this.getAllOnlineUsers();
    let cleaned = 0;
    
    for (const { userId, presence } of onlineUsers) {
      const age = now - presence.lastActivity;
      if (age > maxAgeMs) {
        await this.setOffline(userId);
        cleaned++;
        console.log(`[PresenceService] Cleaned up stale user ${userId} (inactive for ${Math.floor(age / 1000)}s)`);
      }
    }
    
    return cleaned;
  }

  /**
   * Get statistics about presence tracking
   */
  async getStats(): Promise<{
    totalOnline: number;
    onlineActive: number;
    onlineAway: number;
    instanceId: string;
  }> {
    const onlineUsers = await this.getAllOnlineUsers();
    
    const onlineActive = onlineUsers.filter(u => u.presence.status === "online").length;
    const onlineAway = onlineUsers.filter(u => u.presence.status === "away").length;
    
    return {
      totalOnline: onlineUsers.length,
      onlineActive,
      onlineAway,
      instanceId: this.instanceId,
    };
  }
}
