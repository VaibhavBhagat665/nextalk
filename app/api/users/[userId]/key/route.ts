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

  // Fetch user and their settings
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      settings: {
        select: { publicKey: true, x25519PublicKey: true }
      }
    }
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const response: any = {
    username: user.username,
  };

  // Include legacy public key if it exists
  if (user.settings?.publicKey) {
    response.publicKey = JSON.parse(user.settings.publicKey);
  }

  // Include X25519 public key if it exists
  if (user.settings?.x25519PublicKey) {
    response.x25519PublicKey = user.settings.x25519PublicKey;
  }

  return NextResponse.json(response);
}
