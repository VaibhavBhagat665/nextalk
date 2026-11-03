import { verifyToken } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import type { Socket } from "socket.io";

const prisma = new PrismaClient();

export interface AuthenticatedSocket extends Socket {
  userId: string;
  clerkId: string;
  username: string;
  imageUrl: string;
}

/**
 * Socket.io authentication middleware
 * Verifies Clerk JWT token and loads user data from database
 */
export async function authenticateSocket(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  const token = socket.handshake.auth.token;

  if (!token || typeof token !== "string") {
    return next(new Error("Authentication token required"));
  }

  try {
    // Verify JWT signature, expiration, and issuer
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });

    if (!payload || !payload.sub) {
      return next(new Error("Invalid token payload"));
    }

    // Derive Clerk user ID from token (sub = subject = user ID)
    const clerkId = payload.sub;

    // Load user from database to get current username/avatar
    // (Don't trust client-supplied username/imageUrl)
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: {
        id: true,
        clerkId: true,
        username: true,
        imageUrl: true,
        isOnline: true,
      },
    });

    if (!user) {
      return next(new Error("User not found in database"));
    }

    // Attach VERIFIED user data to socket
    (socket as any).userId = user.id;
    (socket as any).clerkId = user.clerkId;
    (socket as any).username = user.username;
    (socket as any).imageUrl = user.imageUrl || "";

    console.log(`✅ Authenticated: ${user.username} (${user.clerkId})`);
    next();
  } catch (err: any) {
    console.error("Socket authentication failed:", err.message);
    
    // Distinguish between different error types
    if (err.message?.includes("expired")) {
      return next(new Error("Token expired. Please refresh your session."));
    }
    
    if (err.message?.includes("signature")) {
      return next(new Error("Invalid token signature"));
    }

    return next(new Error("Authentication failed"));
  }
}

/**
 * Verify user has access to a channel
 * Checks both direct membership (DMs) and server membership (server channels)
 */
export async function verifyChannelAccess(
  userId: string,
  channelId: string
): Promise<boolean> {
  try {
    // Check direct membership first (faster query)
    const membership = await prisma.membership.findUnique({
      where: {
        userId_channelId: {
          userId,
          channelId,
        },
      },
      select: { id: true },
    });

    if (membership) {
      return true;
    }

    // If no direct membership, check if it's a server channel
    // and if user is a server member
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { serverId: true, isPrivate: true },
    });

    if (!channel || !channel.serverId) {
      return false;
    }

    // Check server membership
    const serverMember = await prisma.serverMember.findUnique({
      where: {
        userId_serverId: {
          userId,
          serverId: channel.serverId,
        },
      },
      select: { id: true },
    });

    // Private channels require direct membership even within a server
    if (channel.isPrivate && !membership) {
      return false;
    }

    return !!serverMember;
  } catch (err) {
    console.error("Channel access check failed:", err);
    return false;
  }
}
