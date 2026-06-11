import Redis from "ioredis";

const getRedisUrl = () => {
  const url = process.env.UPSTASH_REDIS_URL;
  if (!url) {
    throw new Error("UPSTASH_REDIS_URL is not defined");
  }
  return url;
};

// Lazy-init Redis clients to avoid crashing at build time
let _redisPub: Redis | null = null;
let _redisSub: Redis | null = null;
let _redis: Redis | null = null;

export function getRedisPub() {
  if (!_redisPub) {
    _redisPub = new Redis(getRedisUrl(), {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return _redisPub;
}

export function getRedisSub() {
  if (!_redisSub) {
    _redisSub = new Redis(getRedisUrl(), {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return _redisSub;
}

function getRedis() {
  if (!_redis) {
    _redis = new Redis(getRedisUrl(), {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return _redis;
}

// Re-export as getter for backward compat
export const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    return (getRedis() as any)[prop];
  },
});

// Presence helpers
const ONLINE_KEY = "nextalk:online";
const TYPING_PREFIX = "nextalk:typing:";

export async function setUserOnline(userId: string) {
  await getRedis().hset(ONLINE_KEY, userId, Date.now().toString());
}

export async function setUserOffline(userId: string) {
  await getRedis().hdel(ONLINE_KEY, userId);
}

export async function getOnlineUsers(): Promise<string[]> {
  const users = await getRedis().hkeys(ONLINE_KEY);
  return users;
}

export async function setTyping(channelId: string, userId: string, username: string) {
  const key = `${TYPING_PREFIX}${channelId}:${userId}`;
  await getRedis().set(key, username, "EX", 5);
}

export async function getTypingUsers(channelId: string): Promise<string[]> {
  const pattern = `${TYPING_PREFIX}${channelId}:*`;
  const keys = await getRedis().keys(pattern);
  if (keys.length === 0) return [];
  const usernames = await Promise.all(keys.map((key) => getRedis().get(key)));
  return usernames.filter(Boolean) as string[];
}
