import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// POST /api/channels/join — join a public channel
export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { channelId } = await req.json();
  if (!channelId) {
    return NextResponse.json({ error: "channelId is required" }, { status: 400 });
  }

  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  if (channel.isPrivate) {
    return NextResponse.json({ error: "Cannot join a private channel" }, { status: 403 });
  }

  // Upsert to avoid duplicates
  await prisma.membership.upsert({
    where: {
      userId_channelId: { userId: user.id, channelId },
    },
    update: {},
    create: {
      userId: user.id,
      channelId,
      role: "member",
    },
  });

  return NextResponse.json({ success: true, channel });
}
