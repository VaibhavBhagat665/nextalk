import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// POST /api/calls — log a new call session
export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { calleeId, channelId, type } = await req.json();

  const call = await prisma.callSession.create({
    data: {
      callerId: user.id,
      calleeId,
      channelId,
      type: type || "voice",
      status: "ringing",
    }
  });

  return NextResponse.json(call);
}

// PATCH /api/calls — update call status/duration
export async function PATCH(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { callId, status, duration } = await req.json();

  const updateData: any = { status };
  if (status === "active") updateData.startedAt = new Date();
  if (["ended", "missed", "rejected"].includes(status)) {
    updateData.endedAt = new Date();
  }
  if (duration !== undefined) updateData.duration = duration;

  const call = await prisma.callSession.update({
    where: { id: callId },
    data: updateData
  });

  return NextResponse.json(call);
}
