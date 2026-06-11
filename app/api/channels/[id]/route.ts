import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/channels/[id] — get channel details (members only)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Verify membership
  const membership = await prisma.membership.findUnique({
    where: { userId_channelId: { userId: user.id, channelId: id } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Not a member of this channel" }, { status: 403 });
  }

  const channel = await prisma.channel.findUnique({
    where: { id },
    include: {
      memberships: {
        include: {
          user: {
            select: { id: true, clerkId: true, username: true, imageUrl: true, isOnline: true },
          },
        },
      },
      _count: { select: { messages: true } },
    },
  });

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...channel,
    members: channel.memberships.map((m) => ({
      ...m.user,
      role: m.role,
    })),
    messageCount: channel._count.messages,
    currentUserRole: membership.role,
  });
}

// PATCH /api/channels/[id] — update channel (admin only)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Admin check
  const membership = await prisma.membership.findUnique({
    where: { userId_channelId: { userId: user.id, channelId: id } },
  });
  if (membership?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { name, description, icon } = await req.json();

  const channel = await prisma.channel.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(icon && { icon }),
    },
  });

  return NextResponse.json(channel);
}

// DELETE /api/channels/[id] — delete channel (admin only)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_channelId: { userId: user.id, channelId: id } },
  });

  if (membership?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Prevent deleting #general
  const channel = await prisma.channel.findUnique({ where: { id } });
  if (channel?.name === "general") {
    return NextResponse.json({ error: "Cannot delete #general" }, { status: 400 });
  }

  await prisma.channel.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
