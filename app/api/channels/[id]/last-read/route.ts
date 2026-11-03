import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/channels/[id]/last-read
 * Gets the user's last read timestamp for a channel
 */
export async function GET(
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

    const membership = await prisma.membership.findUnique({
      where: {
        userId_channelId: {
          userId: user.id,
          channelId,
        },
      },
      select: {
        lastReadAt: true,
      },
    });

    return NextResponse.json({
      lastReadAt: membership?.lastReadAt || null,
    });
  } catch (error) {
    console.error("Error fetching last read:", error);
    return NextResponse.json(
      { error: "Failed to fetch last read position" },
      { status: 500 }
    );
  }
}
