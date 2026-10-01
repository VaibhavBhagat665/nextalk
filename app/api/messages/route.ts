import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { decrypt } from "@/lib/encryption";
import { getMessagesCursor } from "@/lib/cursor-pagination";
import { getCachedMessages, setCachedMessages } from "@/lib/message-cache";

// GET /api/messages?channelId=xxx&cursor=xxx&limit=30
export async function GET(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get("channelId");
  const cursor = searchParams.get("cursor") || undefined;
  const limit = parseInt(searchParams.get("limit") || "50");

  if (!channelId) {
    return NextResponse.json({ error: "channelId is required" }, { status: 400 });
  }

  // Verify membership
  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const membership = await prisma.membership.findUnique({
    where: { userId_channelId: { userId: user.id, channelId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Not a member of this channel" }, { status: 403 });
  }

  // Try cache first (only for first page, no cursor)
  if (!cursor) {
    const cachedMessages = await getCachedMessages(channelId);
    if (cachedMessages !== null) {
      // Decrypt cached messages
      const decryptedCached = await Promise.all(
        cachedMessages.slice(0, limit).map(async (m: any) => ({
          ...m,
          content: await decrypt(m.content),
        }))
      );

      return NextResponse.json({
        messages: decryptedCached,
        nextCursor: cachedMessages.length > limit ? cachedMessages[limit - 1]?.id : null,
        hasMore: cachedMessages.length > limit,
        cached: true,
      });
    }
  }

  // Cache miss or paginated request - fetch from database
  const result = await getMessagesCursor(prisma, {
    channelId,
    cursor,
    limit,
    direction: "forward",
  });

  // Cache first page results for future requests
  if (!cursor && result.messages.length > 0) {
    await setCachedMessages(channelId, result.messages);
  }

  // Decrypt messages
  const decryptedMessages = await Promise.all(
    result.messages.map(async (m: any) => ({
      ...m,
      content: await decrypt(m.content),
    }))
  );

  return NextResponse.json({
    messages: decryptedMessages,
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
    cached: false,
  });
}

// POST /api/messages — send message (REST fallback)
export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { channelId, content, fileUrl, fileName, fileType } = await req.json();

  if (!channelId || (!content && !fileUrl)) {
    return NextResponse.json({ error: "channelId and content/file are required" }, { status: 400 });
  }

  // Verify membership
  const postMembership = await prisma.membership.findUnique({
    where: { userId_channelId: { userId: user.id, channelId } },
  });
  if (!postMembership) {
    return NextResponse.json({ error: "Not a member of this channel" }, { status: 403 });
  }

  const message = await prisma.message.create({
    data: {
      content: content || "",
      fileUrl,
      fileName,
      fileType,
      channelId,
      userId: user.id,
    },
    include: {
      user: {
        select: { id: true, username: true, imageUrl: true, clerkId: true },
      },
    },
  });

  // Update channel updatedAt
  await prisma.channel.update({
    where: { id: channelId },
    data: { updatedAt: new Date() },
  });

  // Invalidate cache for this channel since we added a new message
  const { invalidateChannelCache } = await import("@/lib/message-cache");
  await invalidateChannelCache(channelId);
  
  // Invalidate AI response cache for this channel
  const { invalidateChannelAICache } = await import("@/lib/ai-cache");
  await invalidateChannelAICache(channelId);

  return NextResponse.json(message, { status: 201 });
}
