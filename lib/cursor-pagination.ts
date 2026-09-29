/**
 * Cursor-based Pagination Utilities
 * 
 * Implements keyset pagination using (createdAt, id) pattern for efficient
 * infinite scroll without the performance degradation of OFFSET pagination.
 * 
 * Benefits over OFFSET:
 * - Consistent O(log n) performance regardless of page depth
 * - No missing/duplicate items when data changes
 * - Scales to millions of records
 */

import { Prisma } from "@prisma/client";

export interface CursorPaginationParams {
  channelId: string;
  cursor?: string;  // Encoded cursor: "createdAt_id"
  limit?: number;
  direction?: "forward" | "backward";
}

export interface PaginatedMessages<T> {
  messages: T[];
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
}

/**
 * Encode cursor from createdAt timestamp and message ID
 */
export function encodeCursor(createdAt: Date, id: string): string {
  const timestamp = createdAt.getTime();
  return Buffer.from(`${timestamp}_${id}`).toString("base64url");
}

/**
 * Decode cursor to get createdAt timestamp and message ID
 */
export function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf-8");
    const [timestamp, id] = decoded.split("_");
    
    if (!timestamp || !id) return null;
    
    const timestampNum = parseInt(timestamp, 10);
    if (isNaN(timestampNum)) return null;
    
    return {
      createdAt: new Date(timestampNum),
      id,
    };
  } catch {
    return null;
  }
}

/**
 * Build Prisma where clause for cursor pagination
 * 
 * Uses keyset pagination pattern: WHERE (createdAt, id) < (cursor.createdAt, cursor.id)
 * This leverages the composite index for efficient queries.
 */
export function buildCursorWhere(
  channelId: string,
  cursor: string | undefined,
  direction: "forward" | "backward" = "forward"
): Prisma.MessageWhereInput {
  const baseWhere: Prisma.MessageWhereInput = {
    channelId,
    isDeleted: false,
  };

  if (!cursor) {
    return baseWhere;
  }

  const decoded = decodeCursor(cursor);
  if (!decoded) {
    return baseWhere;
  }

  // Forward pagination: get messages older than cursor (createdAt DESC)
  // Backward pagination: get messages newer than cursor (createdAt ASC)
  if (direction === "forward") {
    return {
      ...baseWhere,
      OR: [
        {
          createdAt: {
            lt: decoded.createdAt,
          },
        },
        {
          createdAt: decoded.createdAt,
          id: {
            lt: decoded.id,
          },
        },
      ],
    };
  } else {
    return {
      ...baseWhere,
      OR: [
        {
          createdAt: {
            gt: decoded.createdAt,
          },
        },
        {
          createdAt: decoded.createdAt,
          id: {
            gt: decoded.id,
          },
        },
      ],
    };
  }
}

/**
 * Get paginated messages using cursor-based pagination
 * 
 * @param prisma - Prisma client instance
 * @param params - Pagination parameters
 * @returns Paginated result with messages and navigation cursors
 */
export async function getMessagesCursor<T = any>(
  prisma: any,
  params: CursorPaginationParams
): Promise<PaginatedMessages<T>> {
  const {
    channelId,
    cursor,
    limit = 50,
    direction = "forward",
  } = params;

  // Fetch one extra to determine if there are more results
  const fetchLimit = limit + 1;

  const where = buildCursorWhere(channelId, cursor, direction);

  const messages = await prisma.message.findMany({
    where,
    take: fetchLimit,
    orderBy: [
      { createdAt: direction === "forward" ? "desc" : "asc" },
      { id: direction === "forward" ? "desc" : "asc" },
    ],
    include: {
      user: {
        select: {
          id: true,
          username: true,
          imageUrl: true,
        },
      },
      reactions: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      },
    },
  });

  // Check if there are more results
  const hasMore = messages.length > limit;
  
  // Remove the extra item if we fetched more than requested
  const results = hasMore ? messages.slice(0, limit) : messages;

  // For forward pagination, reverse to get chronological order
  if (direction === "forward") {
    results.reverse();
  }

  // Generate cursors
  const nextCursor = hasMore && results.length > 0
    ? encodeCursor(results[results.length - 1].createdAt, results[results.length - 1].id)
    : null;

  const prevCursor = results.length > 0
    ? encodeCursor(results[0].createdAt, results[0].id)
    : null;

  return {
    messages: results as T[],
    nextCursor,
    prevCursor,
    hasMore,
  };
}

/**
 * Get messages around a specific message (for "jump to message" feature)
 */
export async function getMessagesAround(
  prisma: any,
  channelId: string,
  messageId: string,
  contextSize: number = 25
): Promise<any[]> {
  // Get the target message
  const targetMessage = await prisma.message.findUnique({
    where: { id: messageId },
  });

  if (!targetMessage) {
    return [];
  }

  // Get messages before (older)
  const before = await prisma.message.findMany({
    where: {
      channelId,
      isDeleted: false,
      OR: [
        { createdAt: { lt: targetMessage.createdAt } },
        {
          createdAt: targetMessage.createdAt,
          id: { lt: messageId },
        },
      ],
    },
    take: contextSize,
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
    include: {
      user: { select: { id: true, username: true, imageUrl: true } },
      reactions: {
        include: {
          user: { select: { id: true, username: true } },
        },
      },
    },
  });

  // Get messages after (newer)
  const after = await prisma.message.findMany({
    where: {
      channelId,
      isDeleted: false,
      OR: [
        { createdAt: { gt: targetMessage.createdAt } },
        {
          createdAt: targetMessage.createdAt,
          id: { gt: messageId },
        },
      ],
    },
    take: contextSize,
    orderBy: [
      { createdAt: "asc" },
      { id: "asc" },
    ],
    include: {
      user: { select: { id: true, username: true, imageUrl: true } },
      reactions: {
        include: {
          user: { select: { id: true, username: true } },
        },
      },
    },
  });

  // Combine: [older messages] + [target] + [newer messages]
  return [
    ...before.reverse(),
    targetMessage,
    ...after,
  ];
}
