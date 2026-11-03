import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/channels/[id]/read
 * Updates the user's last read timestamp for a channel
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: channelId } = await params;

    // Find the user's membership in this channel
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update or create membership with lastReadAt timestamp
    const membership = await prisma.membership.upsert({
      where: {
        userId_channelId: {
          userId: user.id,
          channelId,
        },
      },
      update: {
        lastReadAt: new Date(),
      },
      create: {
        userId: user.id,
        channelId,
        lastReadAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      lastReadAt: membership.lastReadAt,
    });
  } catch (error) {
    console.error("Error updating last read:", error);
    return NextResponse.json(
      { error: "Failed to update last read position" },
      { status: 500 }
    );
  }
}
