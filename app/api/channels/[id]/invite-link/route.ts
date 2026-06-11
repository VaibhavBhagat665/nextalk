import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { clerkId } });
  
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Verify admin role
  const membership = await prisma.membership.findUnique({
    where: { userId_channelId: { userId: user.id, channelId: id } }
  });

  if (membership?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Generate random 8-character code
  const code = Math.random().toString(36).substring(2, 10);

  // Check if channel already has an active link
  const existingLink = await prisma.inviteLink.findFirst({
    where: { channelId: id, isActive: true },
  });

  if (existingLink) {
    // Invalidate existing
    await prisma.inviteLink.update({
      where: { id: existingLink.id },
      data: { isActive: false },
    });
  }

  const inviteLink = await prisma.inviteLink.create({
    data: {
      code,
      channelId: id,
      creatorId: user.id,
    }
  });

  // Also update channel with current active code for quick access
  await prisma.channel.update({
    where: { id },
    data: { inviteCode: code },
  });

  return NextResponse.json(inviteLink);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { clerkId } });
  
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const membership = await prisma.membership.findUnique({
    where: { userId_channelId: { userId: user.id, channelId: id } }
  });

  if (!membership) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const link = await prisma.inviteLink.findFirst({
    where: { channelId: id, isActive: true },
    orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json({ inviteLink: link });
}
