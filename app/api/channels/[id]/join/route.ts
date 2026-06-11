import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// POST /api/channels/[id]/join — join a channel
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id } = await params;

  // Check if already a member
  const existing = await prisma.membership.findUnique({
    where: { userId_channelId: { userId: user.id, channelId: id } },
  });

  if (existing) {
    return NextResponse.json({ message: "Already a member" });
  }

  await prisma.membership.create({
    data: {
      userId: user.id,
      channelId: id,
      role: "member",
    },
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
