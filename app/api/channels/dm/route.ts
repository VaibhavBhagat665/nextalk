import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/channels/dm — list DM conversations for the current user
// This endpoint exists specifically for the mobile app
export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Find all DM channels the user is a member of
  const memberships = await prisma.membership.findMany({
    where: {
      userId: user.id,
      channel: { isDM: true },
    },
    include: {
      channel: {
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: { content: true, createdAt: true },
          },
          memberships: {
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
          },
        },
      },
    },
    orderBy: { channel: { updatedAt: "desc" } },
  });

  const dms = memberships.map((m) => {
    const otherUser = m.channel.memberships?.[0]?.user;
    return {
      id: m.channel.id,
      user: otherUser
        ? {
            id: otherUser.id,
            username: otherUser.username,
            imageUrl: otherUser.imageUrl,
            isOnline: false,
          }
        : { id: "unknown", username: "Unknown User", imageUrl: null, isOnline: false },
      lastMessage: m.channel.messages[0] || null,
      unreadCount: 0,
    };
  });

  return NextResponse.json({ dms });
}
