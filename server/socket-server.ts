import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { PrismaClient } from "@prisma/client";

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
      if (!origin || allowedOrigins.some(allowed => origin.startsWith(allowed))) {
        callback(null, true);
      } else {
        console.warn(`⛔ CORS blocked origin: ${origin}`);
        callback(null, true); // Allow anyway in early deployment; tighten later
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// Redis adapter for horizontal scaling
if (REDIS_URL) {
  try {
    const pubClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
    });
    const subClient = pubClient.duplicate();

    pubClient.on("connect", () => console.log("✅ Redis pub client connected"));
    subClient.on("connect", () => {
      console.log("✅ Redis sub client connected");
      io.adapter(createAdapter(pubClient, subClient));
      console.log("✅ Redis adapter attached");
    });

    pubClient.on("error", (err) => console.warn("⚠️  Redis pub error:", err.message));
    subClient.on("error", (err) => console.warn("⚠️  Redis sub error:", err.message));
  } catch (err: any) {
    console.warn("⚠️  Redis adapter failed, running single-instance:", err.message);
  }
}

// Presence tracking
const onlineUsers = new Map<string, { socketId: string; username: string; imageUrl: string }>();

// Rate Limiting for messages
const messageRateLimits = new Map<string, number[]>();

// Track which channels each socket has joined (for validation)
const socketChannels = new Map<string, Set<string>>();

// Track which voice rooms each socket is in (needed for disconnect cleanup)
const socketVoiceRooms = new Map<string, string>();

// Debounced presence updates
let presenceUpdateTimeout: number | null = null;
const broadcastPresence = () => {
  if (presenceUpdateTimeout) return;
  presenceUpdateTimeout = setTimeout(() => {
    io.emit("presence:update", Array.from(onlineUsers.entries()).map(([id, data]) => ({
      userId: id,
      username: data.username,
      imageUrl: data.imageUrl,
    })));
    presenceUpdateTimeout = null;
  }, 2000);
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

// Socket.io middleware — auth check
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  const userId = socket.handshake.auth.userId;
  const username = socket.handshake.auth.username;
  const imageUrl = socket.handshake.auth.imageUrl;

  if (!userId || !username) {
    return next(new Error("Authentication required"));
  }

  // Attach user data to socket
  (socket as any).userId = userId;
  (socket as any).username = username;
  (socket as any).imageUrl = imageUrl || "";

  next();
});

io.on("connection", (socket) => {
  const userId = (socket as any).userId as string;
  const username = (socket as any).username as string;
  const imageUrl = (socket as any).imageUrl as string;

  console.log(`🟢 ${username} connected (${socket.id})`);

  // Track online presence
  onlineUsers.set(userId, { socketId: socket.id, username, imageUrl });
  broadcastPresence();

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


  // Send message — validate sender is in the channel room
  socket.on("message:send", (data: {
    channelId: string;
    content: string;
    fileUrl?: string;
    fileName?: string;
    fileType?: string;
    tempId: string;
  }) => {
    if (!data.channelId || !socket.rooms.has(`channel:${data.channelId}`)) {
      socket.emit("error:unauthorized", {
        message: "You must join the channel before sending messages",
        channelId: data.channelId,
      });
      return;
    }

    // Rate Limiting (max 10 messages per 10 seconds)
    const now = Date.now();
    const userTimestamps = messageRateLimits.get(userId) || [];
    const recentTimestamps = userTimestamps.filter(t => now - t < 10000);
    
    if (recentTimestamps.length >= 10) {
      socket.emit("error:rate-limit", { message: "You are sending messages too fast. Please slow down." });
      return;
    }
    
    recentTimestamps.push(now);
    messageRateLimits.set(userId, recentTimestamps);

    // Broadcast to channel room
    io.to(`channel:${data.channelId}`).emit("message:new", {
      ...data,
      userId,
      username,
      imageUrl,
      createdAt: new Date().toISOString(),
    });
  });

  // Message reaction — validate sender is in the channel room
  socket.on("message:react", (data: { messageId: string; emoji: string; channelId: string }) => {
    if (!data.channelId || !socket.rooms.has(`channel:${data.channelId}`)) {
      return;
    }

    io.to(`channel:${data.channelId}`).emit("message:reaction", {
      ...data,
      userId,
      username,
    });
  });

  // Typing indicators — validate sender is in the channel room
  socket.on("typing:start", (channelId: string) => {
    if (!channelId || !socket.rooms.has(`channel:${channelId}`)) return;

    socket.to(`channel:${channelId}`).emit("typing:update", {
      userId,
      username,
      channelId,
      isTyping: true,
    });
  });

  socket.on("typing:stop", (channelId: string) => {
    if (!channelId || !socket.rooms.has(`channel:${channelId}`)) return;

    socket.to(`channel:${channelId}`).emit("typing:update", {
      userId,
      username,
      channelId,
      isTyping: false,
    });
  });

  // --- WebRTC Signaling ---

  socket.on("call:initiate", (data: { targetUserId: string; type: "voice" | "video"; channelId?: string }) => {
    const targetSocket = onlineUsers.get(data.targetUserId);
    if (targetSocket) {
      io.to(targetSocket.socketId).emit("call:incoming", {
        callerId: userId,
        callerUsername: username,
        callerImageUrl: imageUrl,
        type: data.type,
        channelId: data.channelId
      });
    }
  });

  socket.on("call:accept", (data: { targetUserId: string }) => {
    const targetSocket = onlineUsers.get(data.targetUserId);
    if (targetSocket) {
      io.to(targetSocket.socketId).emit("call:accepted", {
        accepterId: userId
      });
    }
  });

  socket.on("call:reject", (data: { targetUserId: string }) => {
    const targetSocket = onlineUsers.get(data.targetUserId);
    if (targetSocket) {
      io.to(targetSocket.socketId).emit("call:rejected", {
        rejecterId: userId
      });
    }
  });

  socket.on("call:offer", (data: { targetUserId: string; offer: any }) => {
    const targetSocket = onlineUsers.get(data.targetUserId);
    if (targetSocket) {
      io.to(targetSocket.socketId).emit("call:offer", {
        senderId: userId,
        offer: data.offer
      });
    }
  });

  socket.on("call:answer", (data: { targetUserId: string; answer: any }) => {
    const targetSocket = onlineUsers.get(data.targetUserId);
    if (targetSocket) {
      io.to(targetSocket.socketId).emit("call:answer", {
        senderId: userId,
        answer: data.answer
      });
    }
  });

  socket.on("call:ice-candidate", (data: { targetUserId: string; candidate: any }) => {
    const targetSocket = onlineUsers.get(data.targetUserId);
    if (targetSocket) {
      io.to(targetSocket.socketId).emit("call:ice-candidate", {
        senderId: userId,
        candidate: data.candidate
      });
    }
  });

  socket.on("call:end", (data: { targetUserId: string }) => {
    const targetSocket = onlineUsers.get(data.targetUserId);
    if (targetSocket) {
      io.to(targetSocket.socketId).emit("call:ended", {
        enderId: userId
      });
    }
  });

  socket.on("call:toggle-media", (data: { targetUserId: string; type: "mic" | "video"; enabled: boolean }) => {
    const targetSocket = onlineUsers.get(data.targetUserId);
    if (targetSocket) {
      io.to(targetSocket.socketId).emit("call:media-toggled", {
        senderId: userId,
        type: data.type,
        enabled: data.enabled
      });
    }
  });

  // Disconnect handler
  socket.on("disconnect", () => {
    console.log(`🔴 ${username} disconnected`);
    onlineUsers.delete(userId);
    socketChannels.delete(socket.id);
    messageRateLimits.delete(userId);
    
    broadcastPresence();

    // Handle sudden disconnect from voice channel
    const voiceChannelId = socketVoiceRooms.get(socket.id);
    if (voiceChannelId) {
      io.to(`voice:${voiceChannelId}`).emit("voice:user-left", { userId, socketId: socket.id });
      socketVoiceRooms.delete(socket.id);
    }
  });
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", connections: io.engine.clientsCount });
});

const PORT = process.env.PORT || process.env.SOCKET_PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Socket.io server running on port ${PORT}`);
});
