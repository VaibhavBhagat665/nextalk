import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/invite/[code] — public endpoint to preview invite
export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const inviteLink = await prisma.inviteLink.findUnique({
    where: { code },
    include: {
      channel: {
        include: {
          _count: { select: { memberships: true } },
        }
      },
      creator: { select: { username: true, imageUrl: true } }
    }
  });

  if (!inviteLink || !inviteLink.isActive) {
    return NextResponse.json({ error: "Invalid or expired invite link" }, { status: 404 });
  }

  if (inviteLink.maxUses && inviteLink.uses >= inviteLink.maxUses) {
    return NextResponse.json({ error: "Invite link has reached its use limit" }, { status: 410 });
  }

  if (inviteLink.expiresAt && new Date() > inviteLink.expiresAt) {
    return NextResponse.json({ error: "Invite link has expired" }, { status: 410 });
  }

  return NextResponse.json({
    channel: {
      id: inviteLink.channel.id,
      name: inviteLink.channel.name,
      description: inviteLink.channel.description,
      icon: inviteLink.channel.icon,
      memberCount: inviteLink.channel._count.memberships,
    },
    creator: inviteLink.creator,
  });
}

// POST /api/invite/[code] — accept invite (requires auth)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await params;
  const user = await prisma.user.findUnique({ where: { clerkId } });
  
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const inviteLink = await prisma.inviteLink.findUnique({
    where: { code },
    include: { channel: true }
  });

  if (!inviteLink || !inviteLink.isActive) {
    return NextResponse.json({ error: "Invalid or expired invite link" }, { status: 404 });
  }

  // Enforce Max 60 servers limit
  const membershipCount = await prisma.membership.count({
    where: { userId: user.id }
  });

  if (membershipCount >= 60) {
    return NextResponse.json({ error: "You can only join a maximum of 60 channels" }, { status: 403 });
  }

  // Check if already a member
  const existing = await prisma.membership.findUnique({
    where: { userId_channelId: { userId: user.id, channelId: inviteLink.channelId } }
  });

  if (existing) {
    return NextResponse.json({ channel: inviteLink.channel }); // Already in, just return channel
  }

  // Join channel
  await prisma.$transaction([
    prisma.membership.create({
      data: {
        userId: user.id,
        channelId: inviteLink.channelId,
        role: "member",
      }
    }),
    prisma.inviteLink.update({
      where: { id: inviteLink.id },
      data: { uses: { increment: 1 } }
    }),
    prisma.message.create({
      data: {
        content: `${user.username} joined the channel.`,
        isSystem: true,
        channelId: inviteLink.channelId,
        userId: user.id, // Authored by the joining user for simpler avatar logic
      }
    })
  ]);

  return NextResponse.json({ success: true, channel: inviteLink.channel }, { status: 201 });
}
