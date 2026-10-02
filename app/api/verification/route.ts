import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/verification?verifiedUserId=xxx
 * Get verification status for a user
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const verifiedUserId = req.nextUrl.searchParams.get("verifiedUserId");
    if (!verifiedUserId) {
      return NextResponse.json(
        { error: "verifiedUserId is required" },
        { status: 400 }
      );
    }

    // Get user's internal ID
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check verification status
    const verification = await prisma.keyVerification.findUnique({
      where: {
        userId_verifiedUserId: {
          userId: user.id,
          verifiedUserId: verifiedUserId,
        },
      },
    });

    return NextResponse.json({
      verified: verification?.verified || false,
      safetyNumber: verification?.safetyNumber || null,
      verifiedAt: verification?.verifiedAt || null,
    });
  } catch (error) {
    console.error("Error fetching verification status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/verification
 * Set verification status for a user
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { verifiedUserId, verified, safetyNumber } = body;

    if (!verifiedUserId || typeof verified !== "boolean" || !safetyNumber) {
      return NextResponse.json(
        { error: "verifiedUserId, verified, and safetyNumber are required" },
        { status: 400 }
      );
    }

    // Get user's internal ID
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Create sorted conversation ID
    const conversationId = [user.id, verifiedUserId].sort().join("_");

    // Upsert verification record
    const verification = await prisma.keyVerification.upsert({
      where: {
        userId_verifiedUserId: {
          userId: user.id,
          verifiedUserId: verifiedUserId,
        },
      },
      update: {
        verified,
        safetyNumber,
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        verifiedUserId: verifiedUserId,
        conversationId,
        verified,
        safetyNumber,
      },
    });

    return NextResponse.json({
      success: true,
      verified: verification.verified,
      verifiedAt: verification.verifiedAt,
    });
  } catch (error) {
    console.error("Error updating verification status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
