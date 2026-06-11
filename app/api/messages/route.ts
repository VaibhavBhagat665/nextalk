import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { decrypt } from "@/lib/encryption";

// GET /api/messages?channelId=xxx&cursor=xxx&limit=30
export async function GET(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get("channelId");
  const cursor = searchParams.get("cursor");
  const limit = parseInt(searchParams.get("limit") || "30");

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

  const messages = await prisma.message.findMany({
    where: { channelId, isDeleted: false },
    take: limit + 1,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, username: true, imageUrl: true, clerkId: true },
      },
      reactions: {
        include: {
          user: { select: { id: true, username: true } },
        },
      },
    },
  });

  let nextCursor: string | undefined;
  if (messages.length > limit) {
    const nextItem = messages.pop();
    nextCursor = nextItem?.id;
  }

  // Decrypt messages
  const decryptedMessages = await Promise.all(
    messages.map(async (m) => ({
      ...m,
      content: await decrypt(m.content),
    }))
  );

  return NextResponse.json({
    messages: decryptedMessages.reverse(),
    nextCursor,
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

  return NextResponse.json(message, { status: 201 });
}
