import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { latencyMiddleware } from "./latency-tracker";
import { getAllMetrics, formatPrometheusMetrics } from "./metrics-service";
import { sfuServer } from "./sfu-server";
import { sendPushNotification } from "./push-notification-service";
import { PresenceService } from "./presence-service";

const app = express();
const server = createServer(app);
const prisma = new PrismaClient();

const REDIS_URL = process.env.UPSTASH_REDIS_URL;

// CORS: support multiple origins for production + dev
const allowedOrigins = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.CORS_ORIGIN,
  "http://localhost:3000",
].filter(Boolean) as string[];

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow no-origin requests (native apps, Postman)
      if (!origin) {
        return callback(null, true);
      }
      
      // Check if origin matches any allowed origin exactly
      if (allowedOrigins.some(allowed => origin === allowed)) {
        return callback(null, true);
      }
      
      // Reject all other origins
      console.warn(`⛔ CORS blocked origin: ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// Redis adapter for horizontal scaling
let redisConnected = false;
let presenceService: PresenceService | null = null;

if (REDIS_URL) {
  try {
    const pubClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        console.log(`🔄 Redis reconnecting in ${delay}ms (attempt ${times})`);
        return delay;
      },
      enableOfflineQueue: false,
    });
    const subClient = pubClient.duplicate();

    // Initialize presence service with pub client
    presenceService = new PresenceService(pubClient);

    pubClient.on("connect", () => {
      console.log("✅ Redis pub client connected");
      redisConnected = true;
    });
    
    subClient.on("connect", () => {
      console.log("✅ Redis sub client connected");
      try {
        io.adapter(createAdapter(pubClient, subClient));
        console.log("✅ Redis adapter attached - horizontal scaling enabled");
      } catch (err: any) {
        console.error("❌ Failed to attach Redis adapter:", err.message);
        redisConnected = false;
      }
    });

    pubClient.on("error", (err) => {
      console.warn("⚠️  Redis pub error:", err.message);
      redisConnected = false;
    });
    
    subClient.on("error", (err) => {
      console.warn("⚠️  Redis sub error:", err.message);
      redisConnected = false;
    });

    pubClient.on("close", () => {
      console.warn("⚠️  Redis pub connection closed");
      redisConnected = false;
    });

    subClient.on("close", () => {
      console.warn("⚠️  Redis sub connection closed");
      redisConnected = false;
    });

    // Handle graceful shutdown
    process.on("SIGTERM", async () => {
      console.log("🛑 SIGTERM received, closing Redis connections...");
      await pubClient.quit();
      await subClient.quit();
      process.exit(0);
    });
  } catch (err: any) {
    console.warn("⚠️  Redis adapter initialization failed, running in single-instance mode:", err.message);
    redisConnected = false;
  }
} else {
  console.log("ℹ️  No REDIS_URL configured, running in single-instance mode");
}

// Presence tracking - delegated to PresenceService (Redis-based)
// Falls back to in-memory if Redis unavailable
type PresenceStatus = "online" | "away" | "offline";
interface UserPresence {
  socketId: string;
  username: string;
  imageUrl: string;
  status: PresenceStatus;
  lastActivity: number;
}

// Fallback in-memory presence (used when Redis unavailable)
const fallbackOnlineUsers = new Map<string, UserPresence>();

// Check for idle users every 30 seconds
const IDLE_THRESHOLD = 5 * 60 * 1000; // 5 minutes
const AWAY_CHECK_INTERVAL = 30 * 1000; // 30 seconds

setInterval(async () => {
  if (presenceService) {
    // Redis-based idle check
    const changedUsers = await presenceService.checkIdleUsers();
    if (changedUsers.length > 0) {
      await broadcastPresence();
    }
  } else {
    // Fallback in-memory idle check
    const now = Date.now();
    let changed = false;
    
    for (const [userId, presence] of fallbackOnlineUsers.entries()) {
      const idleTime = now - presence.lastActivity;
      const newStatus: PresenceStatus = idleTime > IDLE_THRESHOLD ? "away" : "online";
      
      if (presence.status !== newStatus) {
        presence.status = newStatus;
        changed = true;
      }
    }
    
    if (changed) {
      await broadcastPresence();
    }
  }
}, AWAY_CHECK_INTERVAL);

// Rate Limiting for messages
const messageRateLimits = new Map<string, number[]>();

// Track which channels each socket has joined (for validation)
const socketChannels = new Map<string, Set<string>>();

// Track which voice rooms each socket is in (needed for disconnect cleanup)
const socketVoiceRooms = new Map<string, string>();

// Debounced presence updates
let presenceUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
const broadcastPresence = async () => {
  if (presenceUpdateTimeout) return;
  presenceUpdateTimeout = setTimeout(async () => {
    try {
      let presenceData;
      
      if (presenceService) {
        // Get presence from Redis
        presenceData = await presenceService.getBroadcastData();
      } else {
        // Fallback to in-memory
        presenceData = Array.from(fallbackOnlineUsers.entries()).map(([id, data]) => ({
          userId: id,
          username: data.username,
          imageUrl: data.imageUrl,
          status: data.status,
        }));
      }
      
      io.emit("presence:update", presenceData);
    } catch (error) {
      console.error("[broadcastPresence] Error:", error);
    }
    presenceUpdateTimeout = null;
  }, 2000);
};

/**
 * Send push notification to offline users or users with backgrounded app
 * @param channelId - Channel where message was sent
 * @param senderId - User ID who sent the message
 * @param senderUsername - Username of sender
 * @param messageContent - Preview of message content
 * @param channelName - Name of channel
 */
async function sendPushForNewMessage(
  channelId: string,
  senderId: string,
  senderUsername: string,
  messageContent: string,
  channelName?: string
): Promise<void> {
  try {
    // Get all members of the channel
    const memberships = await prisma.membership.findMany({
      where: { channelId },
      include: {
        user: {
          include: {
            pushTokens: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    // Filter out the sender and online users
    const offlineMembers = await Promise.all(
      memberships.map(async (membership) => {
        const userId = membership.user.clerkId;
        
        // Don't send push to the sender
        if (userId === senderId) return null;
        
        // Check presence (Redis or fallback)
        let isOnlineAndActive = false;
        if (presenceService) {
          const presence = await presenceService.getPresence(userId);
          isOnlineAndActive = presence?.status === "online";
        } else {
          const presence = fallbackOnlineUsers.get(userId);
          isOnlineAndActive = presence?.status === "online";
        }
        
        // Don't send push if user is online and active
        if (isOnlineAndActive) return null;
        
        // Send push if user is offline or away, and has push tokens
        return membership.user.pushTokens.length > 0 ? membership : null;
      })
    );

    const filtered = offlineMembers.filter((m): m is NonNullable<typeof m> => m !== null);

    if (filtered.length === 0) {
      return;
    }

    // Send push notifications to offline members
    const pushPromises = filtered.flatMap((membership) =>
      membership.user.pushTokens.map((pushToken) => {
        // Truncate message content for preview (max 100 chars)
        const preview = messageContent.length > 100 
          ? `${messageContent.substring(0, 97)}...`
          : messageContent;

        const title = channelName 
          ? `${senderUsername} in ${channelName}`
          : senderUsername;

        return sendPushNotification({
          userId: membership.user.clerkId,
          pushToken: pushToken.token,
          title,
          body: preview,
          data: {
            type: "new_message",
            channelId,
            senderId,
            senderUsername,
          },
        });
      })
    );

    await Promise.all(pushPromises);
    console.log(`📱 Sent ${pushPromises.length} push notifications for channel ${channelId}`);
  } catch (error: any) {
    console.error("Error sending push notifications:", error);
  }
}

// Update user activity timestamp
const updateUserActivity = async (userId: string) => {
  try {
    if (presenceService) {
      await presenceService.updateActivity(userId);
    } else {
      // Fallback to in-memory
      const presence = fallbackOnlineUsers.get(userId);
      if (presence) {
        presence.lastActivity = Date.now();
        // If user was away, set them back to online
        if (presence.status === "away") {
          presence.status = "online";
          await broadcastPresence();
        }
      }
    }
  } catch (error) {
    console.error("[updateUserActivity] Error:", error);
  }
};

/**
 * Verify that a user is a member of a channel via DB lookup.
 * Results are cached per-socket in socketChannels to avoid repeated queries.
 */
async function verifyChannelMembership(
  socketId: string,
  clerkId: string,
  channelId: string
): Promise<boolean> {
  // Check local cache first
  const cached = socketChannels.get(socketId);
  if (cached?.has(channelId)) return true;

  // DB lookup: find user by clerkId then check membership
  try {
    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return false;

    const membership = await prisma.membership.findUnique({
      where: { userId_channelId: { userId: user.id, channelId } },
    });

    if (membership) {
      // Cache this result for the session
      if (!socketChannels.has(socketId)) {
        socketChannels.set(socketId, new Set());
      }
      socketChannels.get(socketId)!.add(channelId);
      return true;
    }
    return false;
  } catch (err) {
    console.error("Membership check failed:", err);
    return false;
  }
}

// Socket.io middleware — latency tracking
io.use(latencyMiddleware);

// Socket.io middleware — auth check with Clerk JWT verification
import { authenticateSocket } from "./socket-auth";

io.use(async (socket, next) => {
  try {
    const authResult = await authenticateSocket(socket);
    
    // Attach verified user data to socket
    (socket as any).userId = authResult.userId;
    (socket as any).username = authResult.username;
    (socket as any).imageUrl = authResult.imageUrl;

    next();
  } catch (error: any) {
    console.error(`❌ Socket auth failed: ${error.message}`);
    next(new Error(error.message || "Authentication failed"));
  }
});

io.on("connection", (socket) => {
  const userId = (socket as any).userId as string;
  const username = (socket as any).username as string;
  const imageUrl = (socket as any).imageUrl as string;

  console.log(`🟢 ${username} connected (${socket.id})`);

  // Track online presence (Redis or fallback)
  (async () => {
    try {
      if (presenceService) {
        await presenceService.setOnline(userId, socket.id, username, imageUrl);
      } else {
        fallbackOnlineUsers.set(userId, {
          socketId: socket.id,
          username,
          imageUrl,
          status: "online",
          lastActivity: Date.now(),
        });
      }
      await broadcastPresence();
    } catch (error) {
      console.error("[connection] Error setting presence:", error);
    }
  })();

  // Join channel room — with membership validation
  socket.on("channel:join", async (channelId: string) => {
    if (!channelId || typeof channelId !== "string") return;

    const isMember = await verifyChannelMembership(socket.id, userId, channelId);
    if (!isMember) {
      socket.emit("error:unauthorized", {
        message: "You are not a member of this channel",
        channelId,
      });
      console.warn(`  ⛔ ${username} denied access to channel:${channelId}`);
      return;
    }

    socket.join(`channel:${channelId}`);
    console.log(`  📌 ${username} joined channel:${channelId}`);
  });

  // Leave channel room
  socket.on("channel:leave", (channelId: string) => {
    socket.leave(`channel:${channelId}`);
    // Remove from cache so re-join requires re-validation
    socketChannels.get(socket.id)?.delete(channelId);
  });

  // --- Voice Channel Events (Mesh WebRTC) ---
  socket.on("voice:join", (channelId: string) => {
    if (!channelId) return;
    
    // Leave any existing voice rooms first
    for (const room of socket.rooms) {
      if (room.startsWith("voice:")) {
        socket.leave(room);
      }
    }
    
    socket.join(`voice:${channelId}`);
    
    // Track voice room for disconnect cleanup
    socketVoiceRooms.set(socket.id, channelId);
    
    // Notify others in the voice room that a new user joined (they will initiate peer connections)
    socket.to(`voice:${channelId}`).emit("voice:user-joined", {
      userId,
      username,
      imageUrl,
      socketId: socket.id
    });
    
    console.log(`  🔊 ${username} joined voice:${channelId}`);
  });

  socket.on("voice:leave", (channelId: string) => {
    socket.leave(`voice:${channelId}`);
    socketVoiceRooms.delete(socket.id);
    socket.to(`voice:${channelId}`).emit("voice:user-left", { userId, socketId: socket.id });
    console.log(`  🔇 ${username} left voice:${channelId}`);
  });

  // Signaling for mesh WebRTC
  socket.on("voice:signal", (data: { targetSocketId: string; signal: any }) => {
    io.to(data.targetSocketId).emit("voice:signal", {
      userId,
      username,
      imageUrl,
      socketId: socket.id,
      signal: data.signal
    });
  });

  // Voice state (muted/deafened) update
  socket.on("voice:state-update", (data: { channelId: string; muted: boolean; deafened: boolean; video: boolean }) => {
    io.to(`voice:${data.channelId}`).emit("voice:state-update", {
      userId,
      socketId: socket.id,
      ...data
    });
  });
  // ----------------------------------------

  // === SFU (mediasoup) Signaling Events ===
  
  /**
   * Join an SFU room (create room and add participant)
   * Returns existing participants with their active producers
   */
  socket.on("sfu:join", async (data: { roomId: string }, callback: (response: any) => void) => {
    try {
      // Create room if it doesn't exist
      const room = await sfuServer.createRoom(data.roomId);
      
      // Add participant to room
      const participant = sfuServer.addParticipant(data.roomId, userId, socket.id, username);
      
      if (!participant) {
        callback({ error: "Failed to add participant to room" });
        return;
      }

      // Get router RTP capabilities for the client
      const rtpCapabilities = sfuServer.getRouterRtpCapabilities(data.roomId);
      
      // Join Socket.io room for signaling
      socket.join(`sfu:${data.roomId}`);
      
      // Notify other participants that someone joined
      socket.to(`sfu:${data.roomId}`).emit("sfu:participant-joined", {
        userId,
        username,
        socketId: socket.id,
      });

      // Get list of existing participants with their producers
      // This allows the new joiner to create consumers for existing media
      const existingParticipants = sfuServer.getRoomParticipants(data.roomId)
        .filter(p => p.id !== userId)
        .map(p => {
          // Get producer details including kind (audio/video)
          const producers = Array.from(p.producers.entries()).map(([id, producer]) => ({
            id,
            kind: producer.kind,
          }));
          
          return {
            userId: p.id,
            username: p.username,
            socketId: p.socketId,
            producers,
          };
        });

      callback({
        rtpCapabilities,
        participants: existingParticipants,
      });

      console.log(`  🎬 ${username} joined SFU room ${data.roomId} (${existingParticipants.length} existing participants)`);
    } catch (error: any) {
      console.error("sfu:join error:", error);
      callback({ error: error.message });
    }
  });

  /**
   * Leave an SFU room
   */
  socket.on("sfu:leave", async (data: { roomId: string }) => {
    try {
      await sfuServer.removeParticipant(data.roomId, userId);
      socket.leave(`sfu:${data.roomId}`);
      
      // Notify others that participant left
      socket.to(`sfu:${data.roomId}`).emit("sfu:participant-left", {
        userId,
        socketId: socket.id,
      });

      console.log(`  🎬 ${username} left SFU room ${data.roomId}`);
    } catch (error: any) {
      console.error("sfu:leave error:", error);
    }
  });

  /**
   * Create a WebRTC transport (send or receive)
   */
  socket.on("sfu:createTransport", async (
    data: { roomId: string; direction: "send" | "recv" },
    callback: (response: any) => void
  ) => {
    try {
      const transportParams = await sfuServer.createWebRtcTransport(
        data.roomId,
        userId,
        data.direction
      );
      
      callback(transportParams);
      console.log(`  🔌 ${username} created ${data.direction} transport in room ${data.roomId}`);
    } catch (error: any) {
      console.error("sfu:createTransport error:", error);
      callback({ error: error.message });
    }
  });

  /**
   * Connect a WebRTC transport
   */
  socket.on("sfu:connectTransport", async (
    data: { roomId: string; transportId: string; dtlsParameters: any },
    callback: (response: any) => void
  ) => {
    try {
      await sfuServer.connectWebRtcTransport(
        data.roomId,
        userId,
        data.transportId,
        data.dtlsParameters
      );
      
      callback({ success: true });
      console.log(`  🔗 ${username} connected transport ${data.transportId}`);
    } catch (error: any) {
      console.error("sfu:connectTransport error:", error);
      callback({ error: error.message });
    }
  });

  /**
   * Produce media (start sending audio/video)
   * Task 19.1: Handle produce event for audio/video
   */
  socket.on("sfu:produce", async (
    data: { 
      roomId: string; 
      transportId: string; 
      kind: "audio" | "video"; 
      rtpParameters: any;
      appData?: any;
    },
    callback: (response: any) => void
  ) => {
    try {
      // Validate room and participant exist
      const participant = sfuServer.getParticipant(data.roomId, userId);
      if (!participant) {
        throw new Error(`Participant ${userId} not found in room ${data.roomId}`);
      }

      // Create producer for client media track
      const producerId = await sfuServer.produce(
        data.roomId,
        userId,
        data.transportId,
        data.kind,
        data.rtpParameters
      );
      
      // Notify other participants that new producer is available
      // This allows them to create consumers for this producer
      socket.to(`sfu:${data.roomId}`).emit("sfu:new-producer", {
        producerId,
        userId,
        username,
        socketId: socket.id,
        kind: data.kind,
        appData: data.appData,
      });

      callback({ 
        producerId,
        kind: data.kind,
      });
      
      console.log(`  🎤 ${username} started producing ${data.kind} (producer: ${producerId}) in room ${data.roomId}`);
    } catch (error: any) {
      console.error("sfu:produce error:", error);
      callback({ error: error.message });
    }
  });

  /**
   * Consume media (start receiving audio/video from another participant)
   * Task 19.2: Handle consume request and configure simulcast layers
   */
  socket.on("sfu:consume", async (
    data: { 
      roomId: string; 
      producerId: string; 
      rtpCapabilities: any;
    },
    callback: (response: any) => void
  ) => {
    try {
      // Validate participant exists
      const participant = sfuServer.getParticipant(data.roomId, userId);
      if (!participant) {
        throw new Error(`Participant ${userId} not found in room ${data.roomId}`);
      }

      if (!participant.recvTransport) {
        throw new Error(`Receive transport not created for ${userId}`);
      }

      // Create consumer for remote producer
      const consumerParams = await sfuServer.consume(
        data.roomId,
        userId,
        data.producerId,
        data.rtpCapabilities
      );
      
      callback(consumerParams);
      console.log(`  🔊 ${username} consuming ${consumerParams.kind} producer ${data.producerId}`);
    } catch (error: any) {
      console.error("sfu:consume error:", error);
      callback({ error: error.message });
    }
  });

  /**
   * Close a producer (stop sending audio/video)
   */
  socket.on("sfu:closeProducer", (data: { roomId: string; producerId: string }) => {
    try {
      sfuServer.closeProducer(data.roomId, userId, data.producerId);
      
      // Notify other participants
      socket.to(`sfu:${data.roomId}`).emit("sfu:producer-closed", {
        producerId: data.producerId,
        userId,
      });

      console.log(`  ❌ ${username} closed producer ${data.producerId}`);
    } catch (error: any) {
      console.error("sfu:closeProducer error:", error);
    }
  });

  /**
   * Close a consumer (stop receiving audio/video)
   */
  socket.on("sfu:closeConsumer", (data: { roomId: string; consumerId: string }) => {
    try {
      sfuServer.closeConsumer(data.roomId, userId, data.consumerId);
      console.log(`  ❌ ${username} closed consumer ${data.consumerId}`);
    } catch (error: any) {
      console.error("sfu:closeConsumer error:", error);
    }
  });

  /**
   * Set preferred layers for a video consumer (simulcast quality adjustment)
   */
  socket.on("sfu:setConsumerLayers", async (
    data: { roomId: string; consumerId: string; spatialLayer: number; temporalLayer?: number },
    callback?: (response: any) => void
  ) => {
    try {
      await sfuServer.setConsumerPreferredLayers(
        data.roomId,
        userId,
        data.consumerId,
        data.spatialLayer,
        data.temporalLayer
      );
      
      if (callback) {
        callback({ success: true });
      }
      console.log(`  🎚️  ${username} set consumer ${data.consumerId} layers: ${data.spatialLayer}/${data.temporalLayer || 0}`);
    } catch (error: any) {
      console.error("sfu:setConsumerLayers error:", error);
      if (callback) {
        callback({ error: error.message });
      }
    }
  });

  /**
   * Pause a consumer (stop receiving temporarily)
   */
  socket.on("sfu:pauseConsumer", async (
    data: { roomId: string; consumerId: string },
    callback?: (response: any) => void
  ) => {
    try {
      await sfuServer.pauseConsumer(data.roomId, userId, data.consumerId);
      
      if (callback) {
        callback({ success: true });
      }
      console.log(`  ⏸️  ${username} paused consumer ${data.consumerId}`);
    } catch (error: any) {
      console.error("sfu:pauseConsumer error:", error);
      if (callback) {
        callback({ error: error.message });
      }
    }
  });

  /**
   * Resume a consumer (start receiving again)
   */
  socket.on("sfu:resumeConsumer", async (
    data: { roomId: string; consumerId: string },
    callback?: (response: any) => void
  ) => {
    try {
      await sfuServer.resumeConsumer(data.roomId, userId, data.consumerId);
      
      if (callback) {
        callback({ success: true });
      }
      console.log(`  ▶️  ${username} resumed consumer ${data.consumerId}`);
    } catch (error: any) {
      console.error("sfu:resumeConsumer error:", error);
      if (callback) {
        callback({ error: error.message });
      }
    }
  });

  // ========================================


  // Send message — server-authoritative (save first, then broadcast)
  socket.on("message:send", async (data: {
    channelId: string;
    content: string;
    fileUrl?: string;
    fileName?: string;
    fileType?: string;
    blurhash?: string;
    imageDimensions?: { width: number; height: number };
    tempId: string;
  }, callback?: (response: any) => void) => {
    try {
      // S3.1: Validate channel membership
      if (!data.channelId || !socket.rooms.has(`channel:${data.channelId}`)) {
        const error = {
          error: "unauthorized",
          message: "You must join the channel before sending messages",
          tempId: data.tempId,
        };
        socket.emit("error:unauthorized", error);
        if (callback) callback(error);
        return;
      }

      // Update user activity (reset away status)
      updateUserActivity(userId);

      // Rate Limiting (max 10 messages per 10 seconds)
      const now = Date.now();
      const userTimestamps = messageRateLimits.get(userId) || [];
      const recentTimestamps = userTimestamps.filter(t => now - t < 10000);
      
      if (recentTimestamps.length >= 10) {
        const error = {
          error: "rate_limit",
          message: "You are sending messages too fast. Please slow down.",
          tempId: data.tempId,
        };
        socket.emit("error:rate-limit", error);
        if (callback) callback(error);
        return;
      }
      
      recentTimestamps.push(now);
      messageRateLimits.set(userId, recentTimestamps);

      // S3.2: Validate content (not empty and within limits)
      if (!data.content?.trim() && !data.fileUrl) {
        const error = {
          error: "validation",
          message: "Message cannot be empty",
          tempId: data.tempId,
        };
        socket.emit("error:validation", error);
        if (callback) callback(error);
        return;
      }

      if (data.content && data.content.length > 4000) {
        const error = {
          error: "validation",
          message: "Message too long (max 4000 characters)",
          tempId: data.tempId,
        };
        socket.emit("error:validation", error);
        if (callback) callback(error);
        return;
      }

      // S3.3: Get user from database (required for foreign key)
      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
      });

      if (!user) {
        const error = {
          error: "auth",
          message: "User not found in database",
          tempId: data.tempId,
        };
        socket.emit("error:unauthorized", error);
        if (callback) callback(error);
        return;
      }

      // S3.4: SAVE TO DATABASE FIRST (server-authoritative)
      const savedMessage = await prisma.message.create({
        data: {
          content: data.content.trim(),
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          fileType: data.fileType,
          // @ts-expect-error - blurhash and imageDimensions are Unsupported types
          blurhash: data.blurhash,
          // @ts-expect-error - imageDimensions is Unsupported type
          imageDimensions: data.imageDimensions,
          channelId: data.channelId,
          userId: user.id,
        },
        include: {
          user: true,
        },
      });

      // S3.5: Get channel info for push notifications
      const channel = await prisma.channel.findUnique({
        where: { id: data.channelId },
      });

      // S3.6: THEN broadcast with real DB ID and timestamp
      const broadcastData = {
        id: savedMessage.id,
        content: savedMessage.content,
        fileUrl: savedMessage.fileUrl,
        fileName: savedMessage.fileName,
        fileType: savedMessage.fileType,
        // @ts-expect-error - blurhash is Unsupported type
        blurhash: savedMessage.blurhash,
        // @ts-expect-error - imageDimensions is Unsupported type
        imageDimensions: savedMessage.imageDimensions,
        channelId: savedMessage.channelId,
        userId,
        username,
        imageUrl,
        createdAt: savedMessage.createdAt.toISOString(),
        tempId: data.tempId, // Client uses this to update optimistic UI
      };

      io.to(`channel:${data.channelId}`).emit("message:new", broadcastData);

      // S3.7: Acknowledge to sender with real message data
      if (callback) {
        callback({
          success: true,
          message: {
            id: savedMessage.id,
            createdAt: savedMessage.createdAt.toISOString(),
          },
        });
      }

      // S3.8: Send push notifications to offline members
      await sendPushForNewMessage(
        data.channelId,
        userId,
        username,
        data.content,
        channel?.name
      );

      console.log(`  💬 ${username} sent message ${savedMessage.id} to channel:${data.channelId}`);
    } catch (error: any) {
      console.error("message:send error:", error);
      
      const errorResponse = {
        error: "server",
        message: "Failed to send message",
        tempId: data.tempId,
      };
      
      socket.emit("error:server", errorResponse);
      if (callback) callback(errorResponse);
    }
  });

  // Message reaction — validate sender is in the channel room
  socket.on("message:react", (data: { messageId: string; emoji: string; channelId: string }) => {
    if (!data.channelId || !socket.rooms.has(`channel:${data.channelId}`)) {
      return;
    }

    // Update user activity
    updateUserActivity(userId);

    io.to(`channel:${data.channelId}`).emit("message:reaction", {
      ...data,
      userId,
      username,
    });
  });

  // Typing indicators — validate sender is in the channel room
  socket.on("typing:start", (channelId: string) => {
    if (!channelId || !socket.rooms.has(`channel:${channelId}`)) return;

    // Update user activity
    updateUserActivity(userId);

    socket.to(`channel:${channelId}`).emit("typing:update", {
      userId,
      username,
      imageUrl,
      channelId,
      isTyping: true,
    });
  });

  socket.on("typing:stop", (channelId: string) => {
    if (!channelId || !socket.rooms.has(`channel:${channelId}`)) return;

    socket.to(`channel:${channelId}`).emit("typing:update", {
      userId,
      username,
      imageUrl,
      channelId,
      isTyping: false,
    });
  });

  // --- WebRTC Signaling ---

  socket.on("call:initiate", async (data: { targetUserId: string; type: "voice" | "video"; channelId?: string }) => {
    try {
      let targetSocket: UserPresence | null = null;
      
      if (presenceService) {
        targetSocket = await presenceService.getPresence(data.targetUserId);
      } else {
        targetSocket = fallbackOnlineUsers.get(data.targetUserId) || null;
      }
      
      if (targetSocket) {
        io.to(targetSocket.socketId).emit("call:incoming", {
          callerId: userId,
          callerUsername: username,
          callerImageUrl: imageUrl,
          type: data.type,
          channelId: data.channelId
        });
      }
    } catch (error) {
      console.error("[call:initiate] Error:", error);
    }
  });

  socket.on("call:accept", async (data: { targetUserId: string }) => {
    try {
      let targetSocket: UserPresence | null = null;
      
      if (presenceService) {
        targetSocket = await presenceService.getPresence(data.targetUserId);
      } else {
        targetSocket = fallbackOnlineUsers.get(data.targetUserId) || null;
      }
      
      if (targetSocket) {
        io.to(targetSocket.socketId).emit("call:accepted", {
          accepterId: userId
        });
      }
    } catch (error) {
      console.error("[call:accept] Error:", error);
    }
  });

  socket.on("call:reject", async (data: { targetUserId: string }) => {
    try {
      let targetSocket: UserPresence | null = null;
      
      if (presenceService) {
        targetSocket = await presenceService.getPresence(data.targetUserId);
      } else {
        targetSocket = fallbackOnlineUsers.get(data.targetUserId) || null;
      }
      
      if (targetSocket) {
        io.to(targetSocket.socketId).emit("call:rejected", {
          rejecterId: userId
        });
      }
    } catch (error) {
      console.error("[call:reject] Error:", error);
    }
  });

  socket.on("call:offer", async (data: { targetUserId: string; offer: any }) => {
    try {
      let targetSocket: UserPresence | null = null;
      
      if (presenceService) {
        targetSocket = await presenceService.getPresence(data.targetUserId);
      } else {
        targetSocket = fallbackOnlineUsers.get(data.targetUserId) || null;
      }
      
      if (targetSocket) {
        io.to(targetSocket.socketId).emit("call:offer", {
          senderId: userId,
          offer: data.offer
        });
      }
    } catch (error) {
      console.error("[call:offer] Error:", error);
    }
  });

  socket.on("call:answer", async (data: { targetUserId: string; answer: any }) => {
    try {
      let targetSocket: UserPresence | null = null;
      
      if (presenceService) {
        targetSocket = await presenceService.getPresence(data.targetUserId);
      } else {
        targetSocket = fallbackOnlineUsers.get(data.targetUserId) || null;
      }
      
      if (targetSocket) {
        io.to(targetSocket.socketId).emit("call:answer", {
          senderId: userId,
          answer: data.answer
        });
      }
    } catch (error) {
      console.error("[call:answer] Error:", error);
    }
  });

  socket.on("call:ice-candidate", async (data: { targetUserId: string; candidate: any }) => {
    try {
      let targetSocket: UserPresence | null = null;
      
      if (presenceService) {
        targetSocket = await presenceService.getPresence(data.targetUserId);
      } else {
        targetSocket = fallbackOnlineUsers.get(data.targetUserId) || null;
      }
      
      if (targetSocket) {
        io.to(targetSocket.socketId).emit("call:ice-candidate", {
          senderId: userId,
          candidate: data.candidate
        });
      }
    } catch (error) {
      console.error("[call:ice-candidate] Error:", error);
    }
  });

  socket.on("call:end", async (data: { targetUserId: string }) => {
    try {
      let targetSocket: UserPresence | null = null;
      
      if (presenceService) {
        targetSocket = await presenceService.getPresence(data.targetUserId);
      } else {
        targetSocket = fallbackOnlineUsers.get(data.targetUserId) || null;
      }
      
      if (targetSocket) {
        io.to(targetSocket.socketId).emit("call:ended", {
          enderId: userId
        });
      }
    } catch (error) {
      console.error("[call:end] Error:", error);
    }
  });

  socket.on("call:toggle-media", async (data: { targetUserId: string; type: "mic" | "video"; enabled: boolean }) => {
    try {
      let targetSocket: UserPresence | null = null;
      
      if (presenceService) {
        targetSocket = await presenceService.getPresence(data.targetUserId);
      } else {
        targetSocket = fallbackOnlineUsers.get(data.targetUserId) || null;
      }
      
      if (targetSocket) {
        io.to(targetSocket.socketId).emit("call:media-toggled", {
          senderId: userId,
          type: data.type,
          enabled: data.enabled
        });
      }
    } catch (error) {
      console.error("[call:toggle-media] Error:", error);
    }
  });

  // Disconnect handler
  socket.on("disconnect", async () => {
    console.log(`🔴 ${username} disconnected`);
    
    // Remove presence (Redis or fallback)
    try {
      if (presenceService) {
        await presenceService.setOffline(userId);
      } else {
        fallbackOnlineUsers.delete(userId);
      }
      await broadcastPresence();
    } catch (error) {
      console.error("[disconnect] Error removing presence:", error);
    }
    
    socketChannels.delete(socket.id);
    messageRateLimits.delete(userId);
    
    await broadcastPresence();

    // Handle sudden disconnect from voice channel
    const voiceChannelId = socketVoiceRooms.get(socket.id);
    if (voiceChannelId) {
      io.to(`voice:${voiceChannelId}`).emit("voice:user-left", { userId, socketId: socket.id });
      socketVoiceRooms.delete(socket.id);
    }

    // Handle sudden disconnect from SFU rooms
    // Find all SFU rooms this user is in and clean up
    for (const room of socket.rooms) {
      if (room.startsWith("sfu:")) {
        const roomId = room.substring(4); // Remove "sfu:" prefix
        try {
          await sfuServer.removeParticipant(roomId, userId);
          socket.to(`sfu:${roomId}`).emit("sfu:participant-left", {
            userId,
            socketId: socket.id,
          });
          console.log(`  🎬 ${username} auto-removed from SFU room ${roomId} on disconnect`);
        } catch (error: any) {
          console.error(`Error cleaning up SFU room ${roomId}:`, error);
        }
      }
    }
  });
});

// Health check
app.get("/health", async (_req, res) => {
  const sfuStats = sfuServer.getStats();
  let presenceStats = null;
  
  if (presenceService) {
    try {
      presenceStats = await presenceService.getStats();
    } catch (error) {
      console.error("[health] Error getting presence stats:", error);
    }
  } else {
    presenceStats = {
      totalOnline: fallbackOnlineUsers.size,
      onlineActive: Array.from(fallbackOnlineUsers.values()).filter(u => u.status === "online").length,
      onlineAway: Array.from(fallbackOnlineUsers.values()).filter(u => u.status === "away").length,
      instanceId: "fallback-memory",
    };
  }
  
  res.json({
    status: "ok",
    connections: io.engine.clientsCount,
    redis: redisConnected ? "connected" : "disconnected",
    mode: redisConnected ? "multi-instance" : "single-instance",
    sfu: sfuStats,
    presence: presenceStats,
  });
});

// Metrics endpoint (JSON format)
app.get("/metrics/json", (_req, res) => {
  const connections = io.engine.clientsCount;
  res.json(getAllMetrics(connections));
});

// Metrics endpoint (Prometheus format)
app.get("/metrics", (_req, res) => {
  const connections = io.engine.clientsCount;
  res.set("Content-Type", "text/plain");
  res.send(formatPrometheusMetrics(connections));
});

const PORT = process.env.PORT || process.env.SOCKET_PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Socket.io server running on port ${PORT}`);
});
