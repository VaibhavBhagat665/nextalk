/**
 * Query Optimization Utilities
 * 
 * Provides reusable query patterns that avoid N+1 queries and optimize database access.
 * All queries use Prisma's `include` and `select` strategically to fetch exactly what's needed.
 */

import { Prisma } from "@prisma/client";

/**
 * Standard message include pattern
 * Fetches user data and reactions in a single query to avoid N+1
 */
export const messageInclude = {
  user: {
    select: {
      id: true,
      username: true,
      imageUrl: true,
      clerkId: true,
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
} satisfies Prisma.MessageInclude;

/**
 * Channel list include pattern for efficient channel loading
 * Fetches the latest message and member count without N+1 queries
 */
export const channelListInclude = {
  _count: {
    select: {
      messages: true,
      memberships: true,
    },
  },
  messages: {
    take: 1,
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      content: true,
      createdAt: true,
      userId: true,
      user: {
        select: {
          username: true,
        },
      },
    },
  },
  server: {
    select: {
      id: true,
      name: true,
      icon: true,
    },
  },
} satisfies Prisma.ChannelInclude;

/**
 * DM channel include pattern
 * Efficiently loads DM channel with other participant info
 */
export function dmChannelInclude(currentUserId: string) {
  return {
    _count: {
      select: { messages: true },
    },
    messages: {
      take: 1,
      orderBy: { createdAt: "desc" as const },
      select: {
        content: true,
        createdAt: true,
        encrypted: true,
      },
    },
    memberships: {
      where: {
        userId: { not: currentUserId },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            imageUrl: true,
            isOnline: true,
            lastSeen: true,
          },
        },
      },
      take: 1,
    },
  } satisfies Prisma.ChannelInclude;
}

/**
 * Server with channels include pattern
 * Loads server with all channels and member counts efficiently
 */
export const serverWithChannelsInclude = {
  channels: {
    include: {
      _count: {
        select: { memberships: true },
      },
    },
    orderBy: {
      createdAt: "asc" as const,
    },
  },
  members: {
    include: {
      user: {
        select: {
          id: true,
          username: true,
          imageUrl: true,
        },
      },
    },
  },
  _count: {
    select: {
      members: true,
      channels: true,
    },
  },
} satisfies Prisma.ServerInclude;

/**
 * User with settings select pattern
 * Minimal user data fetch with settings
 */
export const userWithSettingsSelect = {
  id: true,
  clerkId: true,
  username: true,
  email: true,
  imageUrl: true,
  isOnline: true,
  lastSeen: true,
  settings: true,
} satisfies Prisma.UserSelect;

/**
 * Batch load users by IDs efficiently
 * Prevents N+1 when loading multiple user records
 */
export async function batchLoadUsers(
  prisma: any,
  userIds: string[]
): Promise<Map<string, any>> {
  const users = await prisma.user.findMany({
    where: {
      id: { in: userIds },
    },
    select: {
      id: true,
      username: true,
      imageUrl: true,
      isOnline: true,
    },
  });

  return new Map(users.map((user: any) => [user.id, user]));
}

/**
 * Batch load channels by IDs efficiently
 */
export async function batchLoadChannels(
  prisma: any,
  channelIds: string[]
): Promise<Map<string, any>> {
  const channels = await prisma.channel.findMany({
    where: {
      id: { in: channelIds },
    },
    include: channelListInclude,
  });

  return new Map(channels.map((channel: any) => [channel.id, channel]));
}

/**
 * N+1 Query Prevention Best Practices:
 * 
 * 1. Use `include` instead of separate queries in loops
 * 2. Use `select` to fetch only needed fields
 * 3. Batch load related records with `{ in: [...] }` queries
 * 4. Use composite indexes for filtered + sorted queries
 * 5. Avoid sequential `findUnique` calls - use `findMany` with `where: { id: { in: [...] } }`
 * 
 * Example N+1 (BAD):
 * ```ts
 * const channels = await prisma.channel.findMany();
 * for (const channel of channels) {
 *   const messages = await prisma.message.findMany({ where: { channelId: channel.id } });
 * }
 * ```
 * 
 * Example Optimized (GOOD):
 * ```ts
 * const channels = await prisma.channel.findMany({
 *   include: {
 *     messages: { take: 10, orderBy: { createdAt: 'desc' } }
 *   }
 * });
 * ```
 */
