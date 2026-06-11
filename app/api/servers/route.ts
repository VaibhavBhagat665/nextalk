import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// GET /api/servers — list servers the user belongs to
export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const memberships = await prisma.serverMember.findMany({
    where: { userId: user.id },
    include: {
      server: {
        include: {
          _count: { select: { members: true, channels: true } },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  const servers = memberships.map((m) => ({
    id: m.server.id,
    name: m.server.name,
    icon: m.server.icon,
    role: m.role,
    memberCount: m.server._count.members,
    channelCount: m.server._count.channels,
    inviteCode: m.server.inviteCode,
    isOwner: m.server.ownerId === user.id,
  }));

  return NextResponse.json({ servers });
}

// POST /api/servers — create a new server
export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { name, icon } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Server name is required" }, { status: 400 });
  }

  // Create server + default #general channel + owner membership in a transaction
  const server = await prisma.$transaction(async (tx) => {
    const newServer = await tx.server.create({
      data: {
        name: name.trim(),
        icon: icon || null,
        ownerId: user.id,
      },
    });

    // Create owner membership
    await tx.serverMember.create({
      data: {
        userId: user.id,
        serverId: newServer.id,
        role: "owner",
      },
    });

    // Create default #general channel
    const channel = await tx.channel.create({
      data: {
        name: "general",
        description: "General discussion for everyone",
        icon: "#",
        serverId: newServer.id,
        creatorId: user.id,
      },
    });

    // Auto-join owner to #general
    await tx.membership.create({
      data: {
        userId: user.id,
        channelId: channel.id,
        role: "admin",
      },
    });

    return newServer;
  });

  return NextResponse.json(server, { status: 201 });
}
