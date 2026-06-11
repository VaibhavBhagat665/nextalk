import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// POST /api/channels/leave — leave a channel
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

  // Find the channel
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  // Can't leave the general channel
  if (channel.name === "general") {
    return NextResponse.json(
      { error: "You cannot leave the #general channel" },
      { status: 400 }
    );
  }

  // Find membership
  const membership = await prisma.membership.findUnique({
    where: { userId_channelId: { userId: user.id, channelId } },
  });

  if (!membership) {
    return NextResponse.json({ error: "You are not a member of this channel" }, { status: 400 });
  }

  // If user is admin, check if they are the last admin
  if (membership.role === "admin") {
    const adminCount = await prisma.membership.count({
      where: { channelId, role: "admin" },
    });

    if (adminCount <= 1) {
      // Check if there are other members to promote
      const otherMember = await prisma.membership.findFirst({
        where: { channelId, userId: { not: user.id } },
        orderBy: { createdAt: "asc" },
      });

      if (otherMember) {
        // Promote the oldest member to admin before leaving
        await prisma.membership.update({
          where: { id: otherMember.id },
          data: { role: "admin" },
        });
      } else {
        // Last member — delete the channel entirely
        await prisma.channel.delete({ where: { id: channelId } });
        return NextResponse.json({ success: true, channelDeleted: true });
      }
    }
  }

  // Remove membership
  await prisma.membership.delete({ where: { id: membership.id } });

  return NextResponse.json({ success: true });
}
