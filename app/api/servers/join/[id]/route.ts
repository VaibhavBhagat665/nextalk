import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// POST /api/servers/[id]/join — join a server via invite code
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: inviteCode } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Find server by invite code
  const server = await prisma.server.findUnique({
    where: { inviteCode },
    include: { channels: { take: 1, orderBy: { createdAt: "asc" } } },
  });

  if (!server) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
  }

  // Check if already a member
  const existing = await prisma.serverMember.findUnique({
    where: { userId_serverId: { userId: user.id, serverId: server.id } },
  });

  if (existing) {
    return NextResponse.json({ serverId: server.id, message: "Already a member" });
  }

  // Join server + auto-join all channels
  await prisma.$transaction(async (tx) => {
    await tx.serverMember.create({
      data: { userId: user.id, serverId: server.id, role: "member" },
    });

    // Auto-join all public channels in the server
    const channels = await tx.channel.findMany({
      where: { serverId: server.id, isPrivate: false },
    });

    for (const channel of channels) {
      await tx.membership.upsert({
        where: { userId_channelId: { userId: user.id, channelId: channel.id } },
        create: { userId: user.id, channelId: channel.id, role: "member" },
        update: {},
      });
    }
  });

  return NextResponse.json({ serverId: server.id, message: "Joined successfully" });
}
