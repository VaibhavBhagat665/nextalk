import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return new NextResponse("Unauthorized", { status: 401 });

    const params = await props.params;

    const userProfile = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        settings: { 
          select: { 
            allowDmsFromNonMembers: true,
            x25519PublicKey: true,
            x25519KeyVersion: true,
          } 
        },
      },
    });

    if (!userProfile) return new NextResponse("User not found", { status: 404 });

    // In a real app, we'd check if they share a server. For now, we return the privacy setting.
    return NextResponse.json({
      id: userProfile.id,
      username: userProfile.username,
      imageUrl: userProfile.imageUrl,
      statusMessage: userProfile.statusMessage,
      allowDmsFromNonMembers: userProfile.settings?.allowDmsFromNonMembers ?? true,
      x25519PublicKey: userProfile.settings?.x25519PublicKey ?? null,
      x25519KeyVersion: userProfile.settings?.x25519KeyVersion ?? 1,
    });
  } catch (error) {
    console.error("[USER_PROFILE_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
