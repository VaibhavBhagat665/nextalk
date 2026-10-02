/**
 * Cleanup job for expired DM session keys
 * 
 * This endpoint should be called periodically (e.g., via cron job)
 * to remove expired session keys and maintain forward secrecy.
 * 
 * In production, use a service like:
 * - Vercel Cron Jobs
 * - GitHub Actions scheduled workflow
 * - Upstash QStash
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/dm-session-keys/cleanup
 * 
 * Delete all expired session keys
 * 
 * Headers:
 *   Authorization: Bearer <CLEANUP_SECRET>
 */
export async function POST(req: NextRequest) {
  try {
    // Verify authorization (simple bearer token)
    const authHeader = req.headers.get('authorization');
    const expectedToken = `Bearer ${process.env.CLEANUP_SECRET || 'dev-secret'}`;
    
    if (authHeader !== expectedToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date();

    // Delete all expired session keys
    const result = await prisma.dMSessionKey.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Error cleaning up expired session keys:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup expired keys' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/dm-session-keys/cleanup
 * 
 * Get count of expired session keys without deleting
 */
export async function GET(req: NextRequest) {
  try {
    // Verify authorization
    const authHeader = req.headers.get('authorization');
    const expectedToken = `Bearer ${process.env.CLEANUP_SECRET || 'dev-secret'}`;
    
    if (authHeader !== expectedToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date();

    // Count expired session keys
    const count = await prisma.dMSessionKey.count({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    });

    return NextResponse.json({
      expiredCount: count,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Error checking expired session keys:', error);
    return NextResponse.json(
      { error: 'Failed to check expired keys' },
      { status: 500 }
    );
  }
}
