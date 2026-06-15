import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/channels — list user's channels
export async function GET(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check if requesting DM channels specifically
  const url = new URL(req.url);
  const dmOnly = url.searchParams.get("dm") === "true";

  const memberships = await prisma.membership.findMany({
    where: {
      userId: user.id,
      channel: dmOnly ? { isDM: true } : undefined,
    },
    include: {
      channel: {
        include: {
          _count: { select: { messages: true } },
          messages: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: { content: true, createdAt: true },
          },
          memberships: dmOnly
            ? {
                where: { userId: { not: user.id } },
                include: {
                  user: {
                    select: {
                      id: true,
                      username: true,
                      imageUrl: true,
                    },
                  },
                },
                take: 1,
              }
            : false,
        },
      },
    },
    orderBy: { channel: { updatedAt: "desc" } },
  });

  // If DM mode, format as DM conversations
  if (dmOnly) {
    const dms = memberships
      .filter((m) => m.channel.isDM)
      .map((m) => {
        const otherUser = (m.channel as any).memberships?.[0]?.user;
        return {
          id: m.channel.id,
          user: otherUser
            ? {
                id: otherUser.id,
                username: otherUser.username,
                imageUrl: otherUser.imageUrl,
                isOnline: false, // Would need presence system for real status
              }
            : { id: "unknown", username: "Unknown User", imageUrl: null, isOnline: false },
          lastMessage: m.channel.messages[0] || null,
          unreadCount: 0, // Would need unread tracking
        };
      });
    return NextResponse.json({ dms });
  }

  const channels = memberships.map((m) => ({
    ...m.channel,
    role: m.role,
    lastMessage: m.channel.messages[0] || null,
    messageCount: m.channel._count.messages,
  }));

  return NextResponse.json(channels);
}

// POST /api/channels — create channel or DM
export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { name, description, icon, isPrivate, isDM, targetUserId, type, serverId } = await req.json();

  // Handle DM channel creation
  if (isDM && targetUserId) {
    // Find existing DM channel between these two users
    const existingDM = await prisma.channel.findFirst({
      where: {
        isDM: true,
        memberships: {
          every: {
            userId: { in: [user.id, targetUserId] },
          },
        },
        AND: [
          { memberships: { some: { userId: user.id } } },
          { memberships: { some: { userId: targetUserId } } },
        ],
      },
    });

    if (existingDM) {
      return NextResponse.json(existingDM);
    }

    // Create new DM channel
    const dmName = `dm-${[user.id, targetUserId].sort().join("-")}`;
    const dmChannel = await prisma.channel.create({
      data: {
        name: dmName,
        isDM: true,
        isPrivate: true,
        icon: "#",
      },
    });

    // Add both users
    await prisma.membership.createMany({
      data: [
        { userId: user.id, channelId: dmChannel.id, role: "member" },
        { userId: targetUserId, channelId: dmChannel.id, role: "member" },
      ],
    });

    return NextResponse.json(dmChannel, { status: 201 });
  }

  if (!name || name.trim().length === 0) {
    return NextResponse.json({ error: "Channel name is required" }, { status: 400 });
  }

  // Sanitize channel name
  const sanitizedName = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  try {
    const channel = await prisma.channel.create({
      data: {
        name: sanitizedName,
        description: description || null,
        icon: icon || "#",
        type: type || "text",
        isPrivate: isPrivate || false,
        serverId: serverId || null,
        creatorId: user.id,
      },
    });

    // Auto-join creator as admin
    await prisma.membership.create({
      data: {
        userId: user.id,
        channelId: channel.id,
        role: "admin",
      },
    });

    return NextResponse.json(channel, { status: 201 });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Channel name already exists" }, { status: 409 });
    }
    throw error;
  }
}
