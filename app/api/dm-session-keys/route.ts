/**
 * API routes for DM session key management
 * 
 * Handles:
 * - Creating new session keys
 * - Retrieving current session key metadata
 * - Rotating session keys
 * - Cleaning up expired keys
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { createConversationId } from '@nextalk/crypto';

/**
 * GET /api/dm-session-keys?otherUserId=<userId>
 * 
 * Get current session key metadata for a DM conversation
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const otherUserId = searchParams.get('otherUserId');

    if (!otherUserId) {
      return NextResponse.json(
        { error: 'otherUserId parameter is required' },
        { status: 400 }
      );
    }

    // Create deterministic conversation ID
    const conversationId = createConversationId(userId, otherUserId);

    // Get the current (latest) session key
    const sessionKey = await prisma.dMSessionKey.findFirst({
      where: {
        conversationId,
      },
      orderBy: {
        keyVersion: 'desc',
      },
    });

    return NextResponse.json({ sessionKey });
  } catch (error) {
    console.error('Error fetching session key:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session key' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dm-session-keys
 * 
 * Create a new session key or rotate an existing one
 * 
 * Body: {
 *   otherUserId: string;
 *   salt: string;          // Base64-encoded salt
 *   keyVersion?: number;   // Optional, will auto-increment if rotating
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { otherUserId, salt, keyVersion } = body;

    if (!otherUserId || !salt) {
      return NextResponse.json(
        { error: 'otherUserId and salt are required' },
        { status: 400 }
      );
    }

    // Create deterministic conversation ID
    const conversationId = createConversationId(userId, otherUserId);

    // Determine the key version
    let newKeyVersion = keyVersion || 1;
    
    if (!keyVersion) {
      // Auto-increment: find the latest version
      const latestKey = await prisma.dMSessionKey.findFirst({
        where: { conversationId },
        orderBy: { keyVersion: 'desc' },
      });
      
      if (latestKey) {
        newKeyVersion = latestKey.keyVersion + 1;
      }
    }

    // Calculate expiration (24 hours from now)
    const createdAt = new Date();
    const expiresAt = new Date(createdAt);
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Create the new session key
    const sessionKey = await prisma.dMSessionKey.create({
      data: {
        conversationId,
        keyVersion: newKeyVersion,
        salt,
        messageCount: 0,
        createdAt,
        expiresAt,
      },
    });

    return NextResponse.json({ sessionKey }, { status: 201 });
  } catch (error) {
    console.error('Error creating session key:', error);
    return NextResponse.json(
      { error: 'Failed to create session key' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/dm-session-keys?conversationId=<id>&keyVersion=<version>
 * 
 * Increment message count for a session key
 * 
 * Body: {
 *   increment: number;  // Number of messages to add to count
 * }
 */
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const conversationId = searchParams.get('conversationId');
    const keyVersionStr = searchParams.get('keyVersion');

    if (!conversationId || !keyVersionStr) {
      return NextResponse.json(
        { error: 'conversationId and keyVersion parameters are required' },
        { status: 400 }
      );
    }

    const keyVersion = parseInt(keyVersionStr, 10);
    if (isNaN(keyVersion)) {
      return NextResponse.json(
        { error: 'keyVersion must be a number' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { increment = 1 } = body;

    // Update message count
    const sessionKey = await prisma.dMSessionKey.update({
      where: {
        conversationId_keyVersion: {
          conversationId,
          keyVersion,
        },
      },
      data: {
        messageCount: {
          increment,
        },
      },
    });

    return NextResponse.json({ sessionKey });
  } catch (error) {
    console.error('Error updating session key:', error);
    return NextResponse.json(
      { error: 'Failed to update session key' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dm-session-keys?conversationId=<id>&keyVersion=<version>
 * 
 * Securely delete an old session key after rotation
 */
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const conversationId = searchParams.get('conversationId');
    const keyVersionStr = searchParams.get('keyVersion');

    if (!conversationId || !keyVersionStr) {
      return NextResponse.json(
        { error: 'conversationId and keyVersion parameters are required' },
        { status: 400 }
      );
    }

    const keyVersion = parseInt(keyVersionStr, 10);
    if (isNaN(keyVersion)) {
      return NextResponse.json(
        { error: 'keyVersion must be a number' },
        { status: 400 }
      );
    }

    // Delete the session key
    await prisma.dMSessionKey.delete({
      where: {
        conversationId_keyVersion: {
          conversationId,
          keyVersion,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting session key:', error);
    return NextResponse.json(
      { error: 'Failed to delete session key' },
      { status: 500 }
    );
  }
}
