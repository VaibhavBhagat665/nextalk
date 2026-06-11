import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;

  // We are searching by internal ID, not clerk ID, for the target
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { publicKey: true }
  });

  if (!settings || !settings.publicKey) {
    return NextResponse.json({ error: "User has not set up E2E encryption yet" }, { status: 404 });
  }

  return NextResponse.json({ publicKey: JSON.parse(settings.publicKey) });
}
