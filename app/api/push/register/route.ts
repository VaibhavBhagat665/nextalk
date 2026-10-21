import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isValidPushToken } from "@/server/push-notification-service";

/**
 * POST /api/push/register
 * Register or update a push notification token for the current user
 * 
 * Request body:
 * - token: Expo push token (required)
 * - platform: "ios" | "android" | "web" (required)
 * 
 * Response:
 * - success: boolean
 * - tokenId: string (if successful)
 */
export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Find user by clerkId
    const user = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { token, platform } = body;

    // Validate required fields
    if (!token || !platform) {
      return NextResponse.json(
        { error: "Token and platform are required" },
        { status: 400 }
      );
    }

    // Validate platform
    if (!["ios", "android", "web"].includes(platform)) {
      return NextResponse.json(
        { error: "Invalid platform. Must be ios, android, or web" },
        { status: 400 }
      );
    }

    // Validate Expo push token format
    if (!isValidPushToken(token)) {
      return NextResponse.json(
        { error: "Invalid Expo push token format" },
        { status: 400 }
      );
    }

    // Check if token already exists for this user
    const existingToken = await prisma.pushToken.findUnique({
      where: { token },
    });

    let pushToken;

    if (existingToken) {
      // Update existing token
      if (existingToken.userId === user.id) {
        // Token belongs to this user, just update it
        pushToken = await prisma.pushToken.update({
          where: { token },
          data: {
            platform,
            isActive: true,
            updatedAt: new Date(),
          },
        });
      } else {
        // Token belongs to different user (device was re-registered)
        // Deactivate old token and create new one
        await prisma.pushToken.update({
          where: { token },
          data: { isActive: false },
        });

        pushToken = await prisma.pushToken.create({
          data: {
            userId: user.id,
            token,
            platform,
            isActive: true,
          },
        });
      }
    } else {
      // Create new token
      pushToken = await prisma.pushToken.create({
        data: {
          userId: user.id,
          token,
          platform,
          isActive: true,
        },
      });
    }

    console.log(`✅ Registered push token for user ${user.username} (${platform})`);

    return NextResponse.json({
      success: true,
      tokenId: pushToken.id,
    });
  } catch (error: any) {
    console.error("Error registering push token:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/push/register?token=xxx
 * Deactivate a push notification token
 * 
 * Query params:
 * - token: Expo push token to deactivate (required)
 * 
 * Response:
 * - success: boolean
 */
export async function DELETE(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    // Find user by clerkId
    const user = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Find and deactivate the token
    const existingToken = await prisma.pushToken.findUnique({
      where: { token },
    });

    if (!existingToken) {
      return NextResponse.json(
        { error: "Token not found" },
        { status: 404 }
      );
    }

    // Only allow user to deactivate their own tokens
    if (existingToken.userId !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized to deactivate this token" },
        { status: 403 }
      );
    }

    await prisma.pushToken.update({
      where: { token },
      data: { isActive: false },
    });

    console.log(`✅ Deactivated push token for user ${user.username}`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deactivating push token:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
