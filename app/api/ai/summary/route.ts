import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { summarizeThread } from "@/lib/ai";

// POST /api/ai/summary — generate thread summary (supports incremental via `since`)
export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { channelId, forceRefresh, since } = await req.json();
  if (!channelId) {
    return NextResponse.json({ error: "channelId is required" }, { status: 400 });
  }

  // Verify membership
  const membership = await prisma.membership.findUnique({
    where: { userId_channelId: { userId: user.id, channelId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Not a member of this channel" }, { status: 403 });
  }

  // If not force-refreshing and no `since` param, try cache
  if (!forceRefresh && !since) {
    const cached = await prisma.aISummary.findFirst({
      where: {
        channelId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (cached) {
      return NextResponse.json({
        summary: cached.summary,
        actionItems: cached.actionItems,
        keyTopics: [],
        cached: true,
        summarizedAt: cached.createdAt.toISOString(),
      });
    }
  }

  // Build message query — if `since` is provided, only get messages after that timestamp
  const whereClause: any = { channelId, isDeleted: false };
  if (since) {
    whereClause.createdAt = { gt: new Date(since) };
  }

  const messages = await prisma.message.findMany({
    where: whereClause,
    take: 50,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { username: true } },
    },
  });

  if (messages.length === 0) {
    return NextResponse.json({
      summary: since
        ? "No new messages since the last summary."
        : "No messages in this channel yet. Send a message to get started!",
      actionItems: [],
      keyTopics: [],
      cached: false,
      summarizedAt: new Date().toISOString(),
    });
  }

  const result = await summarizeThread(
    messages.reverse().map((m) => ({
      username: m.user.username,
      content: m.content,
      createdAt: m.createdAt,
      fileUrl: m.fileUrl,
      fileName: m.fileName,
      fileType: m.fileType,
    }))
  );

  // Cache the summary
  await prisma.aISummary.create({
    data: {
      channelId,
      userId: user.id,
      summary: result.summary,
      actionItems: result.actionItems,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  return NextResponse.json({
    ...result,
    cached: false,
    summarizedAt: new Date().toISOString(),
  });
}
