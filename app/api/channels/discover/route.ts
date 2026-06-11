import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/channels/discover — list public channels user hasn't joined
export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Find public channels the user is NOT a member of
  const channels = await prisma.channel.findMany({
    where: {
      isPrivate: false,
      isDM: false,
      memberships: {
        none: {
          userId: user.id,
        },
      },
    },
    include: {
      _count: { select: { memberships: true, messages: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    channels.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      icon: c.icon,
      memberCount: c._count.memberships,
      messageCount: c._count.messages,
    }))
  );
}
