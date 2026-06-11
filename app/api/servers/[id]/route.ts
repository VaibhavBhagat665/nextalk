import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// GET /api/servers/[id] — get server details with channels
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Verify membership
  const membership = await prisma.serverMember.findUnique({
    where: { userId_serverId: { userId: user.id, serverId: id } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const server = await prisma.server.findUnique({
    where: { id },
    include: {
      channels: {
        where: { isDM: false },
        orderBy: { createdAt: "asc" },
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: { content: true, createdAt: true },
          },
        },
      },
      members: {
        include: {
          user: {
            select: { id: true, username: true, imageUrl: true },
          },
        },
      },
      _count: { select: { members: true } },
    },
  });

  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  return NextResponse.json(server);
}

// PATCH /api/servers/[id] — update server
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Only owner/admin can update
  const membership = await prisma.serverMember.findUnique({
    where: { userId_serverId: { userId: user.id, serverId: id } },
  });
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { name, icon } = await req.json();
  const server = await prisma.server.update({
    where: { id },
    data: {
      ...(name && { name: name.trim() }),
      ...(icon !== undefined && { icon }),
    },
  });

  return NextResponse.json(server);
}

// DELETE /api/servers/[id] — delete server (owner only)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const server = await prisma.server.findUnique({ where: { id } });
  if (!server || server.ownerId !== user.id) {
    return NextResponse.json({ error: "Only the owner can delete this server" }, { status: 403 });
  }

  await prisma.server.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
