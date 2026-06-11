import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// POST /api/channels/[id]/invite — invite a user to a channel (admin only)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: channelId } = await params;

  const currentUser = await prisma.user.findUnique({ where: { clerkId } });
  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Verify current user is admin of this channel
  const adminMembership = await prisma.membership.findUnique({
    where: { userId_channelId: { userId: currentUser.id, channelId } },
  });

  if (adminMembership?.role !== "admin") {
    return NextResponse.json(
      { error: "Only channel admins can invite members" },
      { status: 403 }
    );
  }

  const { username } = await req.json();
  if (!username) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }

  // Find the target user
  const targetUser = await prisma.user.findUnique({ where: { username } });
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check if already a member
  const existingMembership = await prisma.membership.findUnique({
    where: { userId_channelId: { userId: targetUser.id, channelId } },
  });

  if (existingMembership) {
    return NextResponse.json(
      { error: "User is already a member of this channel" },
      { status: 409 }
    );
  }

  // Add membership
  await prisma.membership.create({
    data: {
      userId: targetUser.id,
      channelId,
      role: "member",
    },
  });

  return NextResponse.json({
    success: true,
    user: {
      id: targetUser.id,
      username: targetUser.username,
      imageUrl: targetUser.imageUrl,
    },
  });
}
