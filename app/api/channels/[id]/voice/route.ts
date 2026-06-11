import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resolvedParams = await params;
  const channelId = resolvedParams.id;

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  try {
    // Upsert to handle reconnects cleanly
    const voiceState = await prisma.voiceState.upsert({
      where: {
        userId_channelId: {
          userId: user.id,
          channelId,
        },
      },
      update: {
        joinedAt: new Date(),
      },
      create: {
        userId: user.id,
        channelId,
      },
    });

    return NextResponse.json(voiceState);
  } catch (error) {
    console.error("Voice join error:", error);
    return NextResponse.json({ error: "Failed to join voice" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resolvedParams = await params;
  const channelId = resolvedParams.id;

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  try {
    await prisma.voiceState.deleteMany({
      where: {
        userId: user.id,
        channelId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Voice leave error:", error);
    return NextResponse.json({ error: "Failed to leave voice" }, { status: 500 });
  }
}
